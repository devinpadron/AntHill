import { useState, useEffect, useCallback, useMemo } from "react";
import { getUser } from "../services/userService";
import { subscribeAllUsersInCompany } from "../services/companyService";
import { useUser } from "../contexts/UserContext";

// Define proper types for better type safety
type Employee = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	companies: Record<string, string>;
	[key: string]: any;
};

type EmployeeMap = Record<string, Employee>;

export const useEmployeeData = () => {
	const { user, userId, companyId } = useUser();
	const [employees, setEmployees] = useState<EmployeeMap>({});
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch employee data
	const fetchEmployees = useCallback(async () => {
		if (!companyId) {
			console.log("No company ID available");
			return () => {}; // Return empty cleanup function
		}

		setError(null);
		setRefreshing(true);

		try {
			const subscriber = subscribeAllUsersInCompany(
				companyId,
				async (snapshot) => {
					try {
						const employeeData: EmployeeMap = {};

						// Use Promise.all for parallel execution instead of sequential awaits
						const promises = snapshot.docs.map(async (doc) => {
							try {
								const data = await getUser(doc.id);
								if (data) {
									employeeData[doc.id] = {
										id: doc.id,
										...data,
									};
								}
							} catch (userError) {
								console.error(
									`Error fetching user ${doc.id}:`,
									userError,
								);
							}
						});

						await Promise.all(promises);
						setEmployees(employeeData);
					} catch (processError) {
						console.error(
							"Error processing employee data:",
							processError,
						);
						setError("Failed to process employee data");
					} finally {
						setRefreshing(false);
					}
				},
			);

			return subscriber;
		} catch (error) {
			console.error("Error fetching employees:", error);
			setError("Failed to fetch employees");
			setRefreshing(false);
			return () => {}; // Return empty cleanup function
		}
	}, [companyId]);

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
				return Boolean(
					employee &&
						employee.companies &&
						employee.companies[companyId] &&
						employee.firstName,
				);
			})
			.sort((a, b) => {
				const privilegeOrder = { Owner: 0, Admin: 1, User: 2, "": 3 };

				// Get privileges safely with fallbacks
				const aPrivilege = a.companies[companyId] || "";
				const bPrivilege = b.companies[companyId] || "";

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
		error,
	};
};
