import React, { createContext, useContext, useState } from "react";
import storage from "@react-native-firebase/storage";
import db from "../constants/firestore";
import { AttachmentItem } from "../types";

type ParentType = "TimeEntries" | "Events";

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
					// Create storage reference
					const storagePath = `companies/${companyId}/${parentType}/${parentId}/${attachment.id}`;
					const storageRef = storage().ref(storagePath);

					// Upload file with progress tracking
					const task = storageRef.putFile(attachment.uri);

					// Set up progress tracking
					task.on("state_changed", (snapshot) => {
						const progress =
							(snapshot.bytesTransferred / snapshot.totalBytes) *
							100;
						setUploadProgress((prev) => ({
							...prev,
							[attachment.id]: {
								...prev[attachment.id],
								progress: progress,
							},
						}));
					});

					// Wait for upload to complete
					await task;

					// Get download URL
					const downloadUrl = await storageRef.getDownloadURL();

					// Handle thumbnail upload if it exists
					let thumbnailUrl = null;
					if (attachment.thumbnailUri) {
						// Update progress to show we're working on thumbnail
						setUploadProgress((prev) => ({
							...prev,
							[attachment.id]: {
								...prev[attachment.id],
								progress: 80, // Indicate we're working on thumbnail
							},
						}));

						// Create separate storage reference for thumbnail
						const thumbnailPath = `companies/${companyId}/${parentType}/${parentId}/${attachment.id}_thumbnail`;
						const thumbnailRef = storage().ref(thumbnailPath);

						// Upload thumbnail file
						await thumbnailRef.putFile(attachment.thumbnailUri);

						// Get thumbnail download URL
						thumbnailUrl = await thumbnailRef.getDownloadURL();

						// Update progress after thumbnail upload
						setUploadProgress((prev) => ({
							...prev,
							[attachment.id]: {
								...prev[attachment.id],
								progress: 90, // Indicate thumbnail is uploaded
							},
						}));
					}

					// Create Firestore entry
					const attachmentData = {
						id: attachment.id,
						name: attachment.name,
						type: attachment.type,
						size: attachment.size,
						storageRef: storagePath,
						downloadUrl,
						createdAt: new Date(),
						thumbnailUrl: thumbnailUrl, // Use the uploaded thumbnail URL
						thumbnailStorageRef: thumbnailUrl
							? `companies/${companyId}/${parentType}/${parentId}/${attachment.id}_thumbnail`
							: null,
					};

					// Add to Firestore collection
					await db
						.collection("Companies")
						.doc(companyId)
						.collection(parentType)
						.doc(parentId)
						.collection("Attachments")
						.doc(attachment.id)
						.set(attachmentData);

					// Mark as complete
					setUploadProgress((prev) => ({
						...prev,
						[attachment.id]: {
							progress: 100,
							status: "complete",
						},
					}));

					// Mark as existing and update with download URL
					const updatedAttachment: AttachmentItem = {
						...attachment,
						isExisting: true,
						uri: downloadUrl, // Update the URI to the download URL
						thumbnailUri: thumbnailUrl || attachment.thumbnailUri, // Update thumbnail URI if available
					};

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
				// Get the storage reference from Firestore
				const attachmentDoc = await db
					.collection("Companies")
					.doc(companyId)
					.collection(parentType)
					.doc(parentId)
					.collection("Attachments")
					.doc(attachmentId)
					.get();

				if (attachmentDoc.exists) {
					const attachmentData = attachmentDoc.data();

					// Delete from storage if reference exists
					if (attachmentData?.storageRef) {
						const storageRef = storage().ref(
							attachmentData.storageRef,
						);
						await storageRef.delete();
					}

					// Delete thumbnail if it exists
					if (attachmentData?.thumbnailStorageRef) {
						const thumbnailRef = storage().ref(
							attachmentData.thumbnailStorageRef,
						);
						try {
							await thumbnailRef.delete();
						} catch (thumbnailError) {
							console.warn(
								"Could not delete thumbnail:",
								thumbnailError,
							);
							// Continue with deletion even if thumbnail deletion fails
						}
					}

					// Delete from Firestore
					await db
						.collection("Companies")
						.doc(companyId)
						.collection(parentType)
						.doc(parentId)
						.collection("Attachments")
						.doc(attachmentId)
						.delete();

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
