/*
 * Every Firestore collection name in the app.
 *
 * Nothing outside src/services/** may import from here — the layering guard in
 * the pre-commit hook enforces that. Screens and hooks go through services.
 *
 * All lowerCamel plural. The old schema used PascalCase (`Companies`,
 * `Events`); since Firestore collection IDs are case-sensitive, those are
 * disjoint collections that the app no longer reads. tools/migration keeps its
 * own copy of the old names.
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
	locationSegments: "locationSegments",
} as const;

/*
 * Read before sign-in by the launch gate, and deliberately NOT renamed in v2.
 * `AppData/Data` is the force-update lever that already-installed clients read;
 * renaming it would strand the installed base.
 */
export const APP_DATA = { collection: "AppData", doc: "Data" } as const;
export const APP_CONFIG = { collection: "appConfig", doc: "schema" } as const;

/** Deterministic composite IDs, so re-running the migration is idempotent. */
export const membershipId = (companyId: string, userId: string) =>
	`${companyId}_${userId}`;

export const eventResponseId = (eventId: string, userId: string) =>
	`${eventId}_${userId}`;
