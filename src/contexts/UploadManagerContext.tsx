import React, {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import storage from "@react-native-firebase/storage";
import db from "../constants/firestore";
import { AttachmentItem } from "../types";
import NetInfo from "@react-native-community/netinfo";

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

	const activeTasksRef = useRef<{ [key: string]: any }>({});

	useEffect(() => {
		return () => {
			// Cancel any active uploads when provider unmounts
			Object.values(activeTasksRef.current).forEach((task) => {
				if (task && typeof task.cancel === "function") {
					task.cancel();
				}
			});
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
				const hasThumbnail = !!attachment.thumbnailUri;

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

					activeTasksRef.current[attachment.id] = task;

					// Set up progress tracking - main file is 80% of total progress if there's a thumbnail
					task.on("state_changed", (snapshot) => {
						const mainFileProgress =
							(snapshot.bytesTransferred / snapshot.totalBytes) *
							100;

						// If this file has a thumbnail, the main file is worth 80% of total progress
						const adjustedProgress = hasThumbnail
							? mainFileProgress * 0.8 // Main file is 80% of progress
							: mainFileProgress; // No thumbnail = 100% of progress

						setUploadProgress((prev) => ({
							...prev,
							[attachment.id]: {
								...prev[attachment.id],
								progress: adjustedProgress,
							},
						}));
					});

					// Wait for upload to complete
					await task;

					delete activeTasksRef.current[attachment.id];

					// Get download URL
					const downloadUrl = await storageRef.getDownloadURL();

					// Handle thumbnail upload if it exists
					let thumbnailUrl = null;
					if (hasThumbnail) {
						// Create separate storage reference for thumbnail
						const thumbnailPath = `companies/${companyId}/${parentType}/${parentId}/${attachment.id}_thumbnail`;
						const thumbnailRef = storage().ref(thumbnailPath);

						// Upload thumbnail file with progress tracking
						const thumbnailTask = thumbnailRef.putFile(
							attachment.thumbnailUri,
						);

						activeTasksRef.current[`${attachment.id}_thumbnail`] =
							thumbnailTask;

						// Track thumbnail progress (represents final 20% of total progress)
						thumbnailTask.on("state_changed", (snapshot) => {
							const thumbnailProgress =
								(snapshot.bytesTransferred /
									snapshot.totalBytes) *
								100;
							// Main file was 80%, thumbnail is remaining 20%
							const totalProgress = 80 + thumbnailProgress * 0.2;

							setUploadProgress((prev) => ({
								...prev,
								[attachment.id]: {
									...prev[attachment.id],
									progress: totalProgress,
								},
							}));
						});

						// Wait for thumbnail upload to complete
						await thumbnailTask;

						delete activeTasksRef.current[
							`${attachment.id}_thumbnail`
						];

						// Get thumbnail download URL
						thumbnailUrl = await thumbnailRef.getDownloadURL();
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
						thumbnailUrl: thumbnailUrl,
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
					let updatedAttachment: AttachmentItem;
					if (hasThumbnail) {
						updatedAttachment = {
							...attachment,
							isExisting: true,
							uri: downloadUrl,
							thumbnailUri:
								thumbnailUrl || attachment.thumbnailUri,
						};
					} else {
						updatedAttachment = {
							...attachment,
							isExisting: true,
							uri: downloadUrl,
						};
					}

					uploadedAttachments.push(updatedAttachment);
				} catch (error) {
					console.error(
						`Error uploading file ${attachment.id}:`,
						error,
					);

					delete activeTasksRef.current[attachment.id];
					delete activeTasksRef.current[`${attachment.id}_thumbnail`];

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
			Object.keys(activeTasksRef.current).forEach((key) => {
				delete activeTasksRef.current[key];
			});
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
