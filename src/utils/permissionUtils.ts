import { CompanyPreferences, Group, GroupPermissions } from "../types";

/*
 * Group permission resolution, kept pure and React-free so the portal's
 * groups page can share the row list and the baseline with the app.
 *
 * Managers get everything. A worker in no groups gets the company baseline,
 * which is what everyone got before groups carried permissions. A worker in
 * groups gets the OR across them, and a group with no `permissions` field
 * counts as the baseline — so until a manager touches a group, nothing moves.
 */

export const PERMISSION_ROWS: {
	key: keyof GroupPermissions;
	title: string;
	hint: string;
}[] = [
	{
		key: "viewEventLabels",
		title: "See event labels",
		hint: "The label on an event's details.",
	},
	{
		key: "viewManagerNotes",
		title: "See manager notes",
		hint: "The event notes you write for staff.",
	},
	{
		key: "viewCoworkers",
		title: "See who else is assigned",
		hint: "The list of other workers on an event.",
	},
	{
		key: "editEvents",
		title: "Edit events",
		hint: "Change details of events they are assigned to.",
	},
];

export const baselinePermissions = (
	preferences: Pick<
		CompanyPreferences,
		"canViewEventLabels" | "allowUserEventEditing"
	>,
): GroupPermissions => ({
	viewEventLabels: Boolean(preferences.canViewEventLabels),
	viewManagerNotes: true,
	viewCoworkers: true,
	editEvents: Boolean(preferences.allowUserEventEditing),
});

export const resolvePermissions = (
	isAdmin: boolean,
	groups: Group[],
	baseline: GroupPermissions,
): GroupPermissions => {
	if (isAdmin) {
		return {
			viewEventLabels: true,
			viewManagerNotes: true,
			viewCoworkers: true,
			editEvents: true,
		};
	}
	if (groups.length === 0) return baseline;

	const out = { ...baseline };
	for (const row of PERMISSION_ROWS) {
		out[row.key] = groups.some(
			(group) => (group.permissions ?? baseline)[row.key],
		);
	}
	return out;
};
