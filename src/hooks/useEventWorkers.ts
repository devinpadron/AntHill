import { useState, useEffect } from "react";
import { subscribeAllUsersInCompany } from "../services/companyService";
import { getUser } from "../services/userService";
import { getWorkerStatusList } from "../services/availabilityService";

type WorkerItem = {
	label: string;
	value: string;
	userData: any;
	status?: string;
};

const STATUS_PRIORITY = { confirmed: 0, pending: 1, declined: 2 };
const STATUS_EMOJI = { confirmed: "✅", pending: "⏳", declined: "❌" };

const sortWorkersByStatus = (
	workers: WorkerItem[],
	workerStatus: Record<string, string>,
): WorkerItem[] => {
	if (!workers.length) return workers;

	return [...workers].sort((a, b) => {
		const statusA = workerStatus
			? workerStatus[a.value] || "pending"
			: "pending";
		const statusB = workerStatus
			? workerStatus[b.value] || "pending"
			: "pending";

		const priorityDiff =
			STATUS_PRIORITY[statusA] - STATUS_PRIORITY[statusB];

		if (priorityDiff === 0) {
			const nameA = a.userData
				? `${a.userData.firstName} ${a.userData.lastName}`
				: a.label;
			const nameB = b.userData
				? `${b.userData.firstName} ${b.userData.lastName}`
				: b.label;
			return nameA.localeCompare(nameB);
		}

		return priorityDiff;
	});
};

export const useEventWorkers = (
	companyId: string,
	eventId?: string,
	enableAvailability?: boolean,
) => {
	const [availableWorkers, setAvailableWorkers] = useState<WorkerItem[]>([]);
	const [loadingWorkers, setLoadingWorkers] = useState(true);

	useEffect(() => {
		if (!companyId) return;
		setLoadingWorkers(true);

		const subscriber = subscribeAllUsersInCompany(
			companyId,
			async (snapshot) => {
				const workers: WorkerItem[] = await Promise.all(
					snapshot.docs.map(async (doc) => {
						const userData = await getUser(doc.id);
						return {
							label: `${userData.firstName} ${userData.lastName}`,
							value: doc.id,
							userData,
						};
					}),
				);

				if (eventId && enableAvailability) {
					try {
						const workerStatus = await getWorkerStatusList(
							companyId,
							eventId,
						);

						const enhanced = workers.map((worker) => {
							const status =
								workerStatus[worker.value] || "pending";
							return {
								...worker,
								label: `${STATUS_EMOJI[status]} ${worker.userData.firstName} ${worker.userData.lastName}`,
								status,
							};
						});

						const sorted = sortWorkersByStatus(
							enhanced,
							workerStatus,
						);
						setAvailableWorkers(sorted);
					} catch (error) {
						console.error(
							"Error fetching worker status for sorting:",
							error,
						);
						setAvailableWorkers(workers);
					}
				} else {
					setAvailableWorkers(workers);
				}

				setLoadingWorkers(false);
			},
		);

		return () => subscriber();
	}, [companyId, eventId, enableAvailability]);

	return { availableWorkers, setAvailableWorkers, loadingWorkers };
};
