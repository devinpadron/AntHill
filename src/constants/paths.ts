/*
 * Every Firestore collection name in the app.
 *
 * Nothing outside src/services/** may import from here — the layering guard in
 * the pre-commit hook enforces that. Screens and hooks go through services.
 *
 * v1 is PascalCase (`Companies`, `Events`); v2 is lowerCamel plural
 * (`companies`, `events`). Firestore collection IDs are case-sensitive, so the
 * two schemas are disjoint collections living side by side — which is what
 * makes v1 a working rollback target during the migration.
 */

export const C = {
	users: "users",
	userSettings: "userSettings",
	companies: "companies",
	companyPreferences: "companyPreferences",
	memberships: "memberships",
	groups: "groups",
	groupJoinCodes: "groupJoinCodes",
	formSchemas: "formSchemas",
	events: "events",
	eventResponses: "eventResponses",
	eventChecklistStates: "eventChecklistStates",
	timeEntries: "timeEntries",
	attachments: "attachments",
	packages: "packages",
	checklists: "checklists",
	eventLabels: "eventLabels",

	// Subcollections of timeEntries/{entryId}
	connections: "connections",
	edits: "edits",
} as const;

/*
 * Read before sign-in by the launch gate, and deliberately NOT renamed in v2.
 * `AppData/Data` is the force-update lever that already-installed clients read;
 * renaming it would strand the installed base.
 */
export const APP_DATA = { collection: "AppData", doc: "Data" } as const;
export const APP_CONFIG = { collection: "appConfig", doc: "schema" } as const;

/*
 * v1 collections. Referenced only by code that must still read the old schema
 * (the migration tooling and the rollback path). New code uses `C`.
 */
export const LEGACY = {
	users: "Users",
	preferences: "Preferences",
	companies: "Companies",
	settings: "Settings",
	events: "Events",
	timeEntries: "TimeEntries",
	attachments: "Attachments",
	checklists: "Checklists",
	packages: "Packages",
	eventLabels: "EventLabels",
	employees: "Employees",
} as const;

/** Deterministic composite IDs — see the migration plan §3.3 (idempotency). */
export const membershipId = (companyId: string, userId: string) =>
	`${companyId}_${userId}`;

export const eventResponseId = (eventId: string, userId: string) =>
	`${eventId}_${userId}`;
