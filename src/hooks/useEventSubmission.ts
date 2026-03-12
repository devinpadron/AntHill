import { useCallback } from "react";
import { Alert } from "react-native";
import { updateEvent } from "../services/eventService";

type UseEventSubmissionParams = {
	companyId: string;
	title: string;
	handleSubmitData: () => Promise<string | null>;
	handleAttachmentSubmit: (eventId: string) => Promise<void>;
	selectedPackages: string[];
	selectedLabelId: string | null;
};

export const useEventSubmission = ({
	companyId,
	title,
	handleSubmitData,
	handleAttachmentSubmit,
	selectedPackages,
	selectedLabelId,
}: UseEventSubmissionParams) => {
	const handleSubmit = useCallback(async () => {
		if (!title.trim()) {
			Alert.alert("Error", "Please enter a title for the event");
			return;
		}

		const eventId = await handleSubmitData();
		if (!eventId) return;

		handleAttachmentSubmit(eventId);

		await updateEvent(companyId, eventId, {
			packages: selectedPackages,
			labelId: selectedLabelId,
		});
	}, [
		companyId,
		title,
		handleSubmitData,
		handleAttachmentSubmit,
		selectedPackages,
		selectedLabelId,
	]);

	return { handleSubmit };
};
