import { useState, useEffect, useCallback, useMemo } from "react";
import { getUser, getUserPrivilege } from "../services/userService";
import { subscribeAllUsersInCompany } from "../services/companyService";
import { useUser } from "../contexts/UserContext";
import { Role } from "../types/enums/Role";

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
					const newEmployees: EmployeeMap = {};
					for (const doc of snapshot.docs) {
						if (!doc.exists) continue;
						const data = await getUser(doc.id);
						const role = await getUserPrivilege(doc.id, companyId);
						if (data) {
							newEmployees[doc.id] = {
								id: doc.id,
								firstName: data.firstName,
								lastName: data.lastName,
								email: data.email,
								role: role || Role.USER,
							};
						}
					}
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
