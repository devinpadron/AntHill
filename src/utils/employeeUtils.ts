import { Alert } from "react-native";
import {
	removeUserFromCompany,
	changeUserRole,
} from "../services/companyService";
import { Role } from "../types/enums/Role";

export const handleEmployeeAction = (
	employee,
	currentUserRole,
	companyId,
	onRefresh,
) => {
	const employeePrivilege = employee.role;

	// Only owners can manage users
	if (currentUserRole !== Role.OWNER || employeePrivilege === Role.OWNER) {
		return;
	}

	Alert.alert(
		`${employee.firstName} ${employee.lastName}`,
		"What would you like to do?",
		[
			// Dynamically show promote/demote based on current privilege
			employeePrivilege === Role.MANAGER
				? {
						text: "Demote",
						onPress: () =>
							demoteEmployee(employee, companyId, onRefresh),
					}
				: {
						text: "Promote",
						onPress: () =>
							promoteEmployee(employee, companyId, onRefresh),
					},
			{
				text: "Delete",
				style: "destructive",
				onPress: () =>
					confirmDeleteEmployee(employee, companyId, onRefresh),
			},
			{
				text: "Cancel",
				style: "cancel",
			},
		],
	);
};

const promoteEmployee = async (employee, companyId, onRefresh) => {
	try {
		await changeUserRole(employee.id, companyId, Role.MANAGER);
		console.log("Promoted", `${employee.firstName} ${employee.lastName}`);
		onRefresh();
	} catch (error) {
		console.error("Error promoting employee:", error);
		Alert.alert("Error", "Could not promote employee. Please try again.");
	}
};

const demoteEmployee = async (employee, companyId, onRefresh) => {
	try {
		await changeUserRole(employee.id, companyId, Role.USER);
		console.log("Demoted", `${employee.firstName} ${employee.lastName}`);
		onRefresh();
	} catch (error) {
		console.error("Error demoting employee:", error);
		Alert.alert("Error", "Could not demote employee. Please try again.");
	}
};

const confirmDeleteEmployee = (employee, companyId, onRefresh) => {
	Alert.alert(
		"Confirm Delete",
		`Are you sure you want to remove ${employee.firstName} ${employee.lastName} from the company?`,
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
						await removeUserFromCompany(companyId, employee.id);
						console.log(
							"Deleted",
							`${employee.firstName} ${employee.lastName}`,
						);
						onRefresh();
					} catch (error) {
						console.error("Error removing employee:", error);
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
