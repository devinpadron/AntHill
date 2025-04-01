import { Alert } from "react-native";
import { removeUserFromCompany } from "../services/companyService";
import { updateUser } from "../services/userService";

export const handleEmployeeAction = (
	employee,
	currentUser,
	companyId,
	onRefresh,
) => {
	const userPrivilege = currentUser.companies[companyId];
	const employeePrivilege = employee.companies[companyId];

	// Only owners can manage users
	if (userPrivilege !== "Owner" || employeePrivilege === "Owner") {
		return;
	}

	Alert.alert(
		`${employee.firstName} ${employee.lastName}`,
		"What would you like to do?",
		[
			// Dynamically show promote/demote based on current privilege
			employeePrivilege === "Admin"
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
		await updateUser(employee.id, {
			...employee,
			companies: {
				...employee.companies,
				[companyId]: "Admin",
			},
		});
		console.log("Promoted", `${employee.firstName} ${employee.lastName}`);
		onRefresh();
	} catch (error) {
		console.error("Error promoting employee:", error);
		Alert.alert("Error", "Could not promote employee. Please try again.");
	}
};

const demoteEmployee = async (employee, companyId, onRefresh) => {
	try {
		await updateUser(employee.id, {
			...employee,
			companies: {
				...employee.companies,
				[companyId]: "User",
			},
		});
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
