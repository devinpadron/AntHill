/*
 * v2 collection names. Mirrors src/constants/paths.ts in the app.
 *
 * Deliberately duplicated rather than imported: the app file is TypeScript and
 * inside the React Native bundle, and this tooling must never reach into it.
 * The two are checked against each other by the verify pass.
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
	connections: "connections",
	edits: "edits",
};

export const membershipId = (companyId, userId) => `${companyId}_${userId}`;
export const eventResponseId = (eventId, userId) => `${eventId}_${userId}`;
