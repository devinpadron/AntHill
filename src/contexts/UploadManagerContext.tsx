import React, { createContext, useContext, useEffect, useState } from "react";
import { AttachmentItem } from "../types";
import NetInfo from "@react-native-community/netinfo";
import {
	AttachmentParentType,
	cancelAllUploads,
	deleteAttachment,
	uploadAttachment,
} from "../services/storageService";

type ParentType = AttachmentParentType;

// Define a type for the progress map
export type UploadProgressMap = {
	[fileId: string]: {
		progress: number;
		status: "pending" | "uploading" | "complete" | "error";
		error?: string;
	};
};

interface UploadManagerContextProps {
	uploadFiles: (
		attachments: AttachmentItem[],
		companyId: string,
		parentId: string,
		parentType: ParentType,
	) => Promise<AttachmentItem[]>;

	deleteFiles: (
		attachmentIds: string[],
		companyId: string,
		parentId: string,
		parentType: ParentType,
	) => Promise<string[]>;

	isUploading: boolean;
	uploadProgress: UploadProgressMap;
	resetUploadProgress: () => void;
}

const UploadManagerContext = createContext<UploadManagerContextProps | null>(
	null,
);

export const UploadManagerProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<UploadProgressMap>({});

	useEffect(() => {
		return () => {
			// Cancel any active uploads when provider unmounts
			cancelAllUploads();
		};
	}, []);

	// Helper to reset progress tracking
	const resetUploadProgress = () => {
		setUploadProgress({});
	};

	/**
	 * Uploads files to Firebase Storage and stores references in Firestore
	 */
	const uploadFiles = async (
		attachments: AttachmentItem[],
		companyId: string,
		parentId: string,
		parentType: ParentType,
	): Promise<AttachmentItem[]> => {
		//Make sure we are connected to the internet before proceeding
		const netInfo = await NetInfo.fetch();
		if (!netInfo.isConnected) {
			throw new Error("No internet connection available");
		}

		// Filter to only upload attachments that haven't been uploaded yet
		const attachmentsToUpload = attachments.filter(
			(attachment) => !attachment.isExisting,
		);

		if (attachmentsToUpload.length === 0) {
			return [];
		}

		setIsUploading(true);

		// Initialize progress tracking for each file
		const initialProgress: UploadProgressMap = {};
		attachmentsToUpload.forEach((attachment) => {
			initialProgress[attachment.id] = {
				progress: 0,
				status: "pending",
			};
		});
		setUploadProgress(initialProgress);

		try {
			const uploadedAttachments: AttachmentItem[] = [];

			// Process each attachment in sequence
			for (let i = 0; i < attachmentsToUpload.length; i++) {
				const attachment = attachmentsToUpload[i];

				// Update status to uploading
				setUploadProgress((prev) => ({
					...prev,
					[attachment.id]: {
						...prev[attachment.id],
						status: "uploading",
					},
				}));

				try {
					const updatedAttachment = await uploadAttachment(
						attachment,
						companyId,
						parentId,
						parentType,
						(progress) => {
							setUploadProgress((prev) => ({
								...prev,
								[attachment.id]: {
									...prev[attachment.id],
									progress,
								},
							}));
						},
					);

					// Mark as complete
					setUploadProgress((prev) => ({
						...prev,
						[attachment.id]: {
							progress: 100,
							status: "complete",
						},
					}));

					uploadedAttachments.push(updatedAttachment);
				} catch (error) {
					console.error(
						`Error uploading file ${attachment.id}:`,
						error,
					);

					// Mark as error
					setUploadProgress((prev) => ({
						...prev,
						[attachment.id]: {
							progress: 0,
							status: "error",
							error: error.message,
						},
					}));
				}
			}

			return uploadedAttachments;
		} catch (error) {
			console.error("Error uploading files:", error);
			throw new Error(`Failed to upload files: ${error.message}`);
		} finally {
			setIsUploading(false);
		}
	};

	/**
	 * Deletes files from Firebase Storage and removes references from Firestore
	 */
	const deleteFiles = async (
		attachmentIds: string[],
		companyId: string,
		parentId: string,
		parentType: ParentType,
	): Promise<string[]> => {
		if (attachmentIds.length === 0) {
			return [];
		}

		try {
			const deletedIds: string[] = [];

			// Process each attachment in sequence
			for (const attachmentId of attachmentIds) {
				const deleted = await deleteAttachment(
					attachmentId,
					companyId,
					parentId,
					parentType,
				);
				if (deleted) {
					deletedIds.push(attachmentId);
				}
			}

			return deletedIds;
		} catch (error) {
			console.error("Error deleting files:", error);
			throw new Error(`Failed to delete files: ${error.message}`);
		}
	};

	const value = {
		uploadFiles,
		deleteFiles,
		isUploading,
		uploadProgress,
		resetUploadProgress,
	};

	return (
		<UploadManagerContext.Provider value={value}>
			{children}
		</UploadManagerContext.Provider>
	);
};

/**
 * Hook to use the upload manager functionality
 */
export const useUploadManager = () => {
	const context = useContext(UploadManagerContext);

	if (!context) {
		throw new Error(
			"useUploadManager must be used within an UploadManagerProvider",
		);
	}

	return context;
};
