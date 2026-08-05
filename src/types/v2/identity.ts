import { BaseDoc, CompanyScoped, Timestamp } from "./common";
import { Role } from "../enums/Role";

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
	joinedAt: Timestamp;
}

/** companyPreferences/{companyId} */
export interface CompanyPreferences extends CompanyScoped {
	workWeekStarts: "sunday" | "monday";
	allowUserEventEditing: boolean;
	canViewEventLabels: boolean;
	enableTimeSheet: boolean;
	enableAvailability: boolean;
	availabilityReminder: {
		enabled: boolean;
		hours: number;
		minutes: number;
	};
	/** Refs into `formSchemas`, not inline schemas as in v1. */
	eventFormSchemaId: string | null;
	timeEntryFormSchemaId: string | null;
	updatedAt: Timestamp;
	schemaVersion: number;
}
