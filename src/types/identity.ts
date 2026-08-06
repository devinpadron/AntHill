import { BaseDoc, CompanyScoped, Timestamp } from "./common";
import { Role } from "./enums/Role";

/** users/{userId} */
export interface User extends BaseDoc {
	firstName: string;
	lastName: string;
	email: string;
	/** Lowercased copy, for case-insensitive lookup. */
	emailLower: string;
	phone: string | null;
	loggedInCompanyId: string | null;
	fcmTokens: string[];
	/** Adoption telemetry — drives the forced-update cutover decision. */
	lastSeenAppVersion: string | null;
	lastSeenAt: Timestamp | null;
}

/** userSettings/{userId} */
export interface UserSettings {
	userId: string;
	preferredMapApp: "apple" | "google" | "waze";
	defaultCalendarFilter: "all" | "my";
	/**
	 * Appearance choice. Absent on accounts that predate it, which reads as
	 * "system" — so the field is optional rather than defaulted on write.
	 */
	theme?: "light" | "dark" | "system";
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

/** companies/{companyId} */
export interface Company extends BaseDoc {
	name: string;
	accessCode: string;
	/** IANA zone, e.g. "America/New_York". Did not exist in v1. */
	timeZone: string;
}

/**
 * memberships/{companyId}_{userId}
 *
 * Replaces BOTH halves of v1's bidirectional membership (`Users.companies[]`
 * plus `Companies/{c}/Users/{uid}`), which were maintained by two non-atomic
 * writes and could orphan each other.
 *
 * The denormalized name/email/phone are what let a member list load in one
 * query instead of the N+1 fan-outs v1 needed.
 */
export interface Membership extends BaseDoc, CompanyScoped {
	userId: string;
	role: Role;
	firstName: string;
	lastName: string;
	email: string;
	phone: string | null;
	status: "active" | "removed";
	/**
	 * Which unassigned events this worker may see and respond to.
	 *
	 * `open` is v1's behaviour and the default: every event that is not
	 * targeted at a group. `restricted` is for 1099 contractors — they see
	 * nothing but the events they were explicitly invited to.
	 *
	 * Always written explicitly. A query filtering on it would skip documents
	 * where it is absent, so an implicit default is not available here.
	 */
	visibility: WorkerVisibility;
	/** Groups this worker belongs to. Managers publish events to groups. */
	groupIds: string[];
	/**
	 * The group join code this membership was created with, if any.
	 *
	 * Load-bearing rather than informational: the security rules read it back
	 * to confirm that a join claiming a group actually presented that group's
	 * code. See `v2JoinedViaValidCode` in firestore.rules.
	 */
	joinedViaCode?: string;
	joinedAt: Timestamp;
}

export type WorkerVisibility = "open" | "restricted";

/**
 * groups/{groupId}
 *
 * A named set of workers a manager can publish an event to — "Bartenders",
 * "1099 Contractors", "Weekend Crew". Membership is stored on the membership
 * document (`groupIds`), not here, so a member list stays one query.
 */
export interface Group extends BaseDoc, CompanyScoped {
	name: string;
	/**
	 * A join code that drops whoever uses it straight into this group.
	 *
	 * Mirrored into `groupJoinCodes/{code}`, which is what the join actually
	 * validates against. Held here only so a manager can see and rotate it.
	 */
	joinCode: string | null;
	/** What `visibility` a worker joining with that code is given. */
	joinVisibility: WorkerVisibility;
}

/**
 * groupJoinCodes/{code}   — the document id IS the code.
 *
 * Addressed by id and never queried, which is the whole point: `list` is
 * denied, so the collection cannot be enumerated, and you can only read a code
 * you already know. That is what lets the membership rule accept a group
 * assignment at join time without letting a joiner name any group they like.
 */
export interface GroupJoinCode {
	code: string;
	companyId: string;
	groupId: string;
	visibility: WorkerVisibility;
	createdAt: Timestamp;
}

/** companyPreferences/{companyId} */
export interface CompanyPreferences extends CompanyScoped {
	workWeekStarts: "sunday" | "monday";
	allowUserEventEditing: boolean;
	canViewEventLabels: boolean;
	enableTimeSheet: boolean;
	enableAvailability: boolean;
	/**
	 * How often to re-nudge a worker who has not answered an event invitation.
	 *
	 * An INTERVAL, not a lead time. Both clients used to label it "hours before
	 * an event", but nothing anywhere ever read the value — no function, no
	 * screen — so it described a behaviour that did not exist. The
	 * `nudgePendingResponses` function now uses it as the gap between reminders
	 * to the same worker, and the labels say so.
	 *
	 * Zero is treated as unconfigured, not as "nudge on every pass".
	 */
	availabilityReminder: {
		enabled: boolean;
		hours: number;
		minutes: number;
	};
	/*
	 * Whether an assigned worker may flag that they cannot work a shift.
	 *
	 * Acknowledgement itself is always asked — an assignment nobody has seen is
	 * the thing this exists to prevent. This flag only controls the second
	 * button. Off, the worker can confirm and nothing else, and anyone with a
	 * problem is expected to phone; on, they can say so in the app and it shows
	 * up as an unresolved flag on the crew.
	 *
	 * Flagging never unassigns anyone either way.
	 */
	allowAssignmentDecline: boolean;
	/** Refs into `formSchemas`, not inline schemas as in v1. */
	eventFormSchemaId: string | null;
	timeEntryFormSchemaId: string | null;
	updatedAt: Timestamp;
	schemaVersion: number;
}
