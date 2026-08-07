import { BaseDoc, CompanyScoped, Timestamp } from "./common";
import { Role } from "./enums/Role";
import { ClockReminderGeofence, LocationTrackingSettings } from "./location";

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
	/**
	 * When this worker agreed to location tracking, keyed by company.
	 *
	 * PER COMPANY, because someone who works for two caterers agrees to one
	 * employer recording their movements and not necessarily the other. Absent
	 * means never asked; the clock screen asks before the first tracked
	 * clock-in and will not record a thing until there is a timestamp here.
	 *
	 * Kept as a durable record rather than a local flag because it is the
	 * evidence that the disclosure happened — reinstalling the app must not
	 * quietly erase it. It is mirrored into AsyncStorage as well so a clock-in
	 * with no signal can still tell whether consent exists.
	 */
	locationConsentByCompany?: Record<string, Timestamp>;
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
 * Which pushes a worker wants, per company.
 *
 * ON THE MEMBERSHIP, not on userSettings, for three reasons. Managers already
 * read memberships, so "who has notifications off" needs no new rule and no new
 * query. The Cloud Functions have a companyId in every notification payload
 * they build, so one lookup answers the question at the point of sending. And
 * someone who works for two caterers can be reachable by one and not the other,
 * which a single global switch cannot express.
 *
 * EVERY FIELD DEFAULTS TO TRUE, and the whole object is optional — an absent
 * `notifications` means "all on", which is what every existing membership has.
 * Read it through `notificationPrefs()` rather than directly so that stays true.
 */
export interface NotificationPreferences {
	/** Master switch. Off silences every category below. */
	enabled: boolean;
	/** Assigned to, removed from, or changes to an event you work. */
	events: boolean;
	/** Open events to reply to, and reminders that you have not. */
	availability: boolean;
	/** Your timesheets being approved or rejected. */
	timesheets: boolean;
	/** Manager-facing: people joining or leaving, and availability replies. */
	team: boolean;
}

export const NOTIFICATION_CHANNELS = [
	"events",
	"availability",
	"timesheets",
	"team",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const defaultNotificationPreferences: NotificationPreferences = {
	enabled: true,
	events: true,
	availability: true,
	timesheets: true,
	team: true,
};

/**
 * A membership's preferences, with every gap filled in as ON.
 *
 * The single place that turns "absent" into "all on". Reading
 * `membership.notifications.events` directly is undefined for every account
 * that predates this, and `undefined` is falsy — which would silently mute
 * the entire existing user base.
 */
export const notificationPrefs = (
	membership: Pick<Membership, "notifications"> | null | undefined,
): NotificationPreferences => ({
	...defaultNotificationPreferences,
	...(membership?.notifications ?? {}),
});

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
	 * Push preferences. Absent on every membership written before this existed,
	 * and absent means ALL ON — see NotificationPreferences.
	 */
	notifications?: NotificationPreferences;
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

/**
 * A repeating nudge.
 *
 * `hours`/`minutes` are the gap BETWEEN reminders to the same worker, not a
 * lead time before the event. Zero means unconfigured — never "remind on every
 * pass", which at the scheduler's hourly cadence would be once an hour forever.
 */
export interface ReminderSchedule {
	enabled: boolean;
	hours: number;
	minutes: number;
}

/** companyPreferences/{companyId} */
export interface CompanyPreferences extends CompanyScoped {
	workWeekStarts: "sunday" | "monday";
	allowUserEventEditing: boolean;
	canViewEventLabels: boolean;
	enableTimeSheet: boolean;
	enableAvailability: boolean;
	/**
	 * How often to re-nudge a worker who has not answered an event INVITATION.
	 *
	 * An INTERVAL, not a lead time. Both clients used to label it "hours before
	 * an event", but nothing anywhere ever read the value — no function, no
	 * screen — so it described a behaviour that did not exist. The
	 * `nudgePendingResponses` function now uses it as the gap between reminders
	 * to the same worker, and the labels say so.
	 *
	 * Zero is treated as unconfigured, not as "nudge on every pass".
	 */
	availabilityReminder: ReminderSchedule;

	/**
	 * Whether a worker added to a crew must confirm they have seen it.
	 *
	 * Assignment is a statement, not a question — the shift simply appears in
	 * someone's list — and this is what makes them register it. Companies that
	 * schedule by phone first and use the app only as a record do not need the
	 * ceremony, so they can switch it off; the banner, the Calendar badge and
	 * the reminder below all disappear with it.
	 */
	requireAssignmentAcknowledgement: boolean;

	/**
	 * How often to re-nudge a worker who has not confirmed an assigned SHIFT.
	 *
	 * A separate schedule from availabilityReminder because it asks a different
	 * question of a different group. "Have you seen your shift" is usually
	 * worth asking more often than "can you work this", and a company may want
	 * one without the other.
	 *
	 * AUTO-SILENCED when requireAssignmentAcknowledgement is off — there is no
	 * point chasing an answer nobody is being asked for, and leaving a live
	 * reminder behind a disabled requirement is how a setting starts lying.
	 */
	acknowledgementReminder: ReminderSchedule;

	/**
	 * Record where a worker goes between clock-in and clock-out.
	 *
	 * OFF by default, and it must stay that way: switching it on starts
	 * recording the movements of every member of the company, and doing that to
	 * an existing customer as a side effect of an update would be indefensible.
	 * Separate from the geofence below so a company can have the helpful
	 * reminder without tracking anyone.
	 */
	locationTracking: LocationTrackingSettings;

	/**
	 * Remind workers to clock in on arrival and out on departure.
	 *
	 * OFF by default. It only ever posts a notification — nothing here clocks
	 * anyone in or out, and nothing should ever be added that does. Enabled with
	 * no coordinates set is treated as unconfigured and monitors nothing, the
	 * same way a zero-interval ReminderSchedule sends nothing.
	 */
	clockReminderGeofence: ClockReminderGeofence;

	/** Refs into `formSchemas`, not inline schemas as in v1. */
	eventFormSchemaId: string | null;
	timeEntryFormSchemaId: string | null;
	updatedAt: Timestamp;
	schemaVersion: number;
}
