import { Alert } from "react-native";
import {
	removeMember,
	changeMemberRole,
} from "../services/v2/membershipService";
import { Role } from "../types";

/**
 * The subset of a member row these actions need.
 *
 * Structural rather than the full `Membership`, so the caller can pass the
 * flattened row it already renders instead of the raw document.
 */
type MemberSummary = {
	id: string;
	firstName: string;
	lastName: string;
	role: Role;
};

const fullName = (member: MemberSummary) =>
	`${member.firstName} ${member.lastName}`;

/**
 * Long-press menu for a member row: promote, demote, or remove.
 *
 * Owner-only, and never offered for another owner — an owner cannot be demoted
 * or removed from the UI.
 *
 * Every action writes through `membershipService`, which owns
 * `memberships/{companyId}_{userId}`. These previously went through the v1
 * company service and wrote to `Companies/{c}/Users/{uid}`, a path that holds
 * no documents under the v2 schema, so each one silently changed nothing.
 *
 * `onDone` exists for callers that fetch once. Callers on a live subscription
 * (EmployeeList) pass a no-op and let the snapshot repaint.
 */
export const showMemberActions = (
	member: MemberSummary,
	// `""` while the membership is still loading — see UserContext.role.
	currentUserRole: Role | "",
	companyId: string,
	onDone: () => void,
) => {
	if (currentUserRole !== Role.OWNER || member.role === Role.OWNER) {
		return;
	}

	const isManager = member.role === Role.MANAGER;

	Alert.alert(fullName(member), "What would you like to do?", [
		isManager
			? {
					text: "Demote",
					onPress: () =>
						setRole(member, companyId, Role.USER, onDone),
				}
			: {
					text: "Promote",
					onPress: () =>
						setRole(member, companyId, Role.MANAGER, onDone),
				},
		{
			text: "Delete",
			style: "destructive",
			onPress: () => confirmRemove(member, companyId, onDone),
		},
		{
			text: "Cancel",
			style: "cancel",
		},
	]);
};

const setRole = async (
	member: MemberSummary,
	companyId: string,
	role: Role,
	onDone: () => void,
) => {
	const verb = role === Role.MANAGER ? "promote" : "demote";

	try {
		await changeMemberRole(companyId, member.id, role);
		onDone();
	} catch (e) {
		console.error(`Error trying to ${verb} member`, e);
		Alert.alert("Error", `Could not ${verb} employee. Please try again.`);
	}
};

const confirmRemove = (
	member: MemberSummary,
	companyId: string,
	onDone: () => void,
) => {
	Alert.alert(
		"Confirm Delete",
		`Are you sure you want to remove ${fullName(member)} from the company?`,
		[
			{
				text: "Cancel",
				style: "cancel",
			},
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					try {
						await removeMember(companyId, member.id);
						onDone();
					} catch (e) {
						console.error("Error removing member", e);
						Alert.alert(
							"Error",
							"Could not remove employee. Please try again.",
						);
					}
				},
			},
		],
	);
};
