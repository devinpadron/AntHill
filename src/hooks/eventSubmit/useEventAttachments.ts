import { useState, useEffect, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { getEventAttachments } from "../../services/eventService";
import { useUploadManager } from "../../contexts/UploadManagerContext";
import { AttachmentItem } from "../../types";

export const useEventAttachments = (
	companyId: string,
	eventId?: string,
	navigation?: any,
) => {
	const { uploadFiles, deleteFiles, isUploading, uploadProgress } =
		useUploadManager();
	const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
	const [attachmentDeletionQueue, setAttachmentDeletionQueue] = useState<
		string[]
	>([]);
	const isMounted = useRef(true);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	// Load attachments when editing
	useEffect(() => {
		if (eventId && companyId) {
			const fetchAttachments = async () => {
				const result = await getEventAttachments(companyId, eventId);
				setAttachments(result);
			};
			fetchAttachments();
		}
	}, [eventId, companyId]);

	const handleAttachmentSubmit = useCallback(
		async (submittedEventId: string) => {
			try {
				if (!isMounted.current) return;

				if (!submittedEventId || !companyId) {
					Alert.alert(
						"Error",
						"Unable to save event information. Please try again.",
					);
					return;
				}

				// Validate attachments before proceeding
				const validAttachments = attachments.filter((att) =>
					att.uri
						? att.uri.startsWith("file://") ||
							att.uri.startsWith("http")
						: false,
				);

				if (validAttachments.length !== attachments.length) {
					console.warn(
						`Found ${attachments.length - validAttachments.length} invalid attachments`,
					);
				}

				// First delete any files in the deletion queue
				if (attachmentDeletionQueue.length > 0) {
					await deleteFiles(
						attachmentDeletionQueue,
						companyId,
						submittedEventId,
						"Events",
					);
				}

				// Then upload any new files
				if (validAttachments.length > 0) {
					const uploaded = await uploadFiles(
						validAttachments,
						companyId,
						submittedEventId,
						"Events",
					);

					if (uploaded && uploaded.length > 0) {
						const existing = attachments.filter(
							(att) => att.isExisting,
						);
						setAttachments([...existing, ...uploaded]);
					}
				}

				// Clear deletion queue
				setAttachmentDeletionQueue([]);

				// Only navigate after all operations are complete
				if (isMounted.current) {
					navigation?.pop();
				}
			} catch (error) {
				console.error("Error handling attachments:", error);
				Alert.alert(
					"Upload Error",
					"There was an error uploading attachments. Please try again.",
				);
			}
		},
		[
			attachments,
			attachmentDeletionQueue,
			companyId,
			deleteFiles,
			uploadFiles,
			navigation,
		],
	);

	return {
		attachments,
		setAttachments,
		attachmentDeletionQueue,
		setAttachmentDeletionQueue,
		isUploading,
		uploadProgress,
		handleAttachmentSubmit,
	};
};
