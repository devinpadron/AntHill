import { useState, useEffect } from "react";
import { getUser } from "../services/userService";
import { subscribeEvent, updateEvent } from "../services/eventService";
import { subscribeEventAttachments } from "../services/attachmentService";
import { FileUpload } from "../types";
import { useUser } from "../contexts/UserContext";

export const useEventDetails = (eventId: string) => {
	const [event, setEvent] = useState<any>(null);
	const [workerList, setWorkerList] = useState("");
	const [localNotes, setLocalNotes] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [attachments, setAttachments] = useState<FileUpload[]>([]);

	// Subscribe to current user
	const { user } = useUser();

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

	// Subscribe to event attachments
	useEffect(() => {
		if (!event || !user) return;

		const subscriber = subscribeEventAttachments(
			user.loggedInCompany,
			eventId,
			(attachments) => {
				const files = attachments.docs.map(
					(doc) => doc.data() as FileUpload,
				);
				setAttachments(files);
			},
		);

		return () => subscriber();
	}, [event, user, eventId]);

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

	const hasEditPermission =
		user?.companies[user?.loggedInCompany] === "Owner" ||
		user?.companies[user?.loggedInCompany] === "Admin";

	return {
		user,
		event,
		workerList,
		localNotes,
		setLocalNotes,
		isLoading,
		attachments,
		saveNotes,
		hasEditPermission,
	};
};
