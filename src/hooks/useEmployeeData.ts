import { useState, useEffect, useCallback, useMemo } from "react";
import { batchGetUserPrivileges, batchGetUsers } from "../services/userService";
import { subscribeAllUsersInCompany } from "../services/companyService";
import { useUser } from "../contexts/UserContext";
import { Role } from "../types";

// Define proper types for better type safety
type Employee = {
	firstName: string;
	lastName: string;
	email: string;
	id: string;
	role?: string;
};

type EmployeeMap = Record<string, Employee>;

export const useEmployeeData = () => {
	const { userId, companyId } = useUser();
	const [employees, setEmployees] = useState<EmployeeMap>({});
	const [refreshing, setRefreshing] = useState(false);

	// Fetch employee data
	const fetchEmployees = useCallback(async () => {
		if (!userId) return;
		try {
			const unsubscribe = subscribeAllUsersInCompany(
				companyId,
				async (snapshot) => {
					// Extract all user IDs first
					const userIds = snapshot.docs
						.filter((doc) => doc.exists)
						.map((doc) => doc.id);

					if (userIds.length === 0) {
						setEmployees({});
						setRefreshing(false);
						return;
					}

					// Batch fetch user data and privileges
					const [usersData, userPrivileges] = await Promise.all([
						batchGetUsers(userIds),
						batchGetUserPrivileges(userIds, companyId),
					]);

					// Combine the data
					const newEmployees: EmployeeMap = {};
					userIds.forEach((userId) => {
						const userData = usersData[userId];
						const userRole = userPrivileges[userId] || Role.USER;

						if (userData) {
							newEmployees[userId] = {
								id: userId,
								firstName: userData.firstName,
								lastName: userData.lastName,
								email: userData.email,
								role: userRole,
								phone: userData.phone || "", // Ensure phone is always a string
							};
						}
					});

					setEmployees(newEmployees);
					setRefreshing(false);
				},
			);
			return unsubscribe;
		} catch (error) {
			console.error("Error fetching employees:", error);
			setRefreshing(false);
		}
	}, [userId, companyId]);

	// Initial data fetch
	useEffect(() => {
		let unsubscribe: (() => void) | undefined;

		const setup = async () => {
			unsubscribe = await fetchEmployees();
		};

		setup();

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [fetchEmployees]);

	// Process and sort employees - using useMemo for performance
	const sortedEmployees = useMemo(() => {
		if (!companyId) return [];

		return Object.values(employees)
			.filter((employee): employee is Employee => {
				// Safe null checks
				return Boolean(employee && employee.role && employee.firstName);
			})
			.sort((a, b) => {
				const privilegeOrder = { owner: 0, manager: 1, user: 2, "": 3 };

				// Get privileges safely with fallbacks
				const aPrivilege = a.role || "";
				const bPrivilege = b.role || "";

				// Sort by privilege level first
				if (privilegeOrder[aPrivilege] !== privilegeOrder[bPrivilege]) {
					return (
						(privilegeOrder[aPrivilege] ?? 99) -
						(privilegeOrder[bPrivilege] ?? 99)
					);
				}

				// Then by first name
				return a.firstName.localeCompare(b.firstName);
			});
	}, [employees, companyId]);

	return {
		employees: sortedEmployees,
		refreshing,
		refetchEmployees: fetchEmployees,
		companyId,
	};
};
