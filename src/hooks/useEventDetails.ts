import { useState, useEffect } from "react";
import { getUser } from "../services/userService";
import {
	getEventAttachments,
	subscribeEvent,
	updateEvent,
} from "../services/eventService";
import { useUser } from "../contexts/UserContext";
import { get, set } from "lodash";

export const useEventDetails = (eventId: string) => {
	const [event, setEvent] = useState<any>(null);
	const [attachments, setAttachments] = useState<any[]>([]);
	const [workerList, setWorkerList] = useState("");
	const [localNotes, setLocalNotes] = useState("");
	const [isLoading, setIsLoading] = useState(true);

	// Subscribe to current user
	const { user, isAdmin } = useUser();

	// Subscribe to event data
	useEffect(() => {
		if (!user) return;

		const subscriber = subscribeEvent(
			user.loggedInCompany,
			eventId,
			(event) => {
				setEvent(event.data());
			},
		);

		return () => subscriber();
	}, [user, eventId]);

	useEffect(() => {
		if (!event) return;

		const getAttachments = async () => {
			const attachments = await getEventAttachments(
				user.loggedInCompany,
				eventId,
			);
			setAttachments(attachments);
		};

		getAttachments();

		console.log(attachments);
	}, [event]);

	// Process event data
	useEffect(() => {
		if (!event) return;

		// Initialize local notes
		setLocalNotes(event.userNotes || "");

		// Get worker list
		const getWorkerList = async () => {
			setWorkerList("");
			const assignedWorkers = event.assignedWorkers || [];

			if (assignedWorkers.length === 0) {
				setIsLoading(false);
				return;
			}

			try {
				const workerNames = await Promise.all(
					assignedWorkers.map(async (workerId) => {
						const workerData = await getUser(workerId);
						return `${workerData.firstName} ${workerData.lastName}`;
					}),
				);

				setWorkerList(workerNames.join(", "));
			} catch (error) {
				console.error("Error fetching workers:", error);
			} finally {
				setIsLoading(false);
			}
		};

		getWorkerList();
	}, [event]);

	// Save user notes
	const saveNotes = () => {
		if (localNotes !== event?.userNotes && user && event) {
			const updatedEvent = {
				...event,
				userNotes: localNotes,
			};

			updateEvent(user.loggedInCompany, eventId, updatedEvent);
		}
	};

	const hasEditPermission = isAdmin;

	return {
		user,
		event,
		attachments,
		workerList,
		localNotes,
		setLocalNotes,
		isLoading,
		saveNotes,
		hasEditPermission,
	};
};
