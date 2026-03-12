import { useState, useCallback } from "react";
import {
	confirmEvent,
	declineEvent,
	getWorkerStatusList,
} from "../services/availabilityService";
import { getAllUsersInCompany } from "../services/companyService";
import { User } from "../types";

type WorkerWithStatus = User & { status: string };

type CategorizedWorkers = {
	confirmed: WorkerWithStatus[];
	declined: WorkerWithStatus[];
	unconfirmed: WorkerWithStatus[];
};

/**
 * useAdminWorkerDetails
 *
 * Manages the admin modal for viewing and changing worker availability statuses
 * on a per-event basis. Handles fetching all company users, categorizing them
 * by status, and admin-level confirm/decline actions.
 */
export const useAdminWorkerDetails = (
	companyId: string,
	onRefreshEvents: () => void,
) => {
	const [adminModalVisible, setAdminModalVisible] = useState(false);
	const [selectedEventForAdmin, setSelectedEventForAdmin] = useState(null);
	const [eventWorkerDetails, setEventWorkerDetails] =
		useState<CategorizedWorkers>({
			confirmed: [],
			declined: [],
			unconfirmed: [],
		});
	const [loadingWorkerDetails, setLoadingWorkerDetails] = useState(false);

	const fetchEventWorkerDetails = useCallback(
		async (event) => {
			setLoadingWorkerDetails(true);
			try {
				// Get all users in the company (returns a map)
				const usersMap = await getAllUsersInCompany(companyId);

				// Convert the map to an array of users
				const allUsers = Object.values(usersMap);

				// Fetch fresh worker status from Firebase instead of using stale local data
				const workerStatus = await getWorkerStatusList(
					companyId,
					event.id,
				);

				// Categorize users based on their status in the workerStatus map
				const categorizedUsers: CategorizedWorkers = {
					confirmed: [],
					declined: [],
					unconfirmed: [],
				};

				allUsers.forEach((user: User) => {
					const userStatus = workerStatus[user.id];

					const userWithStatus = {
						...user,
						status: userStatus || "available",
					};

					if (userStatus === "confirmed") {
						categorizedUsers.confirmed.push(userWithStatus);
					} else if (userStatus === "declined") {
						categorizedUsers.declined.push(userWithStatus);
					} else if (userStatus === "pending") {
						categorizedUsers.unconfirmed.push({
							...userWithStatus,
							status: "pending",
						});
					} else {
						categorizedUsers.unconfirmed.push({
							...userWithStatus,
							status: "pending",
						});
					}
				});

				setEventWorkerDetails(categorizedUsers);
			} catch (error) {
				console.error("Error fetching worker details:", error);
			} finally {
				setLoadingWorkerDetails(false);
			}
		},
		[companyId],
	);

	const handleAdminStatusChange = useCallback(
		async (targetUserId: string, newStatus: string) => {
			if (!selectedEventForAdmin) return;
			const eventId = selectedEventForAdmin.id;

			if (newStatus === "confirmed") {
				await confirmEvent(companyId, eventId, targetUserId);
			} else if (newStatus === "declined") {
				await declineEvent(companyId, eventId, targetUserId);
			}

			// Refresh worker details in the modal
			fetchEventWorkerDetails(selectedEventForAdmin);
			// Refresh the main event list
			onRefreshEvents();
		},
		[
			companyId,
			selectedEventForAdmin,
			fetchEventWorkerDetails,
			onRefreshEvents,
		],
	);

	const handleAdminEventPress = useCallback(
		(event) => {
			setSelectedEventForAdmin(event);
			setAdminModalVisible(true);
			fetchEventWorkerDetails(event);
		},
		[fetchEventWorkerDetails],
	);

	const closeAdminModal = useCallback(() => {
		setAdminModalVisible(false);
	}, []);

	return {
		adminModalVisible,
		selectedEventForAdmin,
		eventWorkerDetails,
		loadingWorkerDetails,
		handleAdminEventPress,
		handleAdminStatusChange,
		closeAdminModal,
	};
};
