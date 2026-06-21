import storage from "@react-native-firebase/storage";
import db from "../constants/firestore";
import { AttachmentItem } from "../types";

export type AttachmentParentType = "TimeEntries" | "Events";

type ProgressFn = (progress: number) => void;

// Registry of in-flight upload tasks so they can be cancelled on unmount.
const activeTasks: { [key: string]: any } = {};

/**
 * Cancels every in-flight upload task. Used when the upload manager unmounts.
 */
export function cancelAllUploads() {
	Object.values(activeTasks).forEach((task) => {
		if (task && typeof task.cancel === "function") {
			task.cancel();
		}
	});
	Object.keys(activeTasks).forEach((key) => delete activeTasks[key]);
}

/**
 * Uploads a single attachment (and its thumbnail, if present) to Storage and
 * writes the attachment metadata to Firestore. Reports progress 0-100 via
 * onProgress. Returns the attachment marked as existing with its download URL.
 */
export async function uploadAttachment(
	attachment: AttachmentItem,
	companyId: string,
	parentId: string,
	parentType: AttachmentParentType,
	onProgress: ProgressFn,
): Promise<AttachmentItem> {
	const hasThumbnail = !!attachment.thumbnailUri;
	const storagePath = `companies/${companyId}/${parentType}/${parentId}/${attachment.id}`;

	try {
		// Upload main file. If there is a thumbnail, the main file is 80% of progress.
		const storageRef = storage().ref(storagePath);
		const task = storageRef.putFile(attachment.uri);
		activeTasks[attachment.id] = task;

		task.on("state_changed", (snapshot) => {
			const mainFileProgress =
				(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
			onProgress(
				hasThumbnail ? mainFileProgress * 0.8 : mainFileProgress,
			);
		});

		await task;
		delete activeTasks[attachment.id];

		const downloadUrl = await storageRef.getDownloadURL();

		// Upload thumbnail (final 20% of progress) if one exists.
		let thumbnailUrl: string | null = null;
		let thumbnailStorageRef: string | null = null;
		if (hasThumbnail) {
			const thumbnailPath = `${storagePath}_thumbnail`;
			const thumbnailRef = storage().ref(thumbnailPath);
			const thumbnailTask = thumbnailRef.putFile(attachment.thumbnailUri);
			activeTasks[`${attachment.id}_thumbnail`] = thumbnailTask;

			thumbnailTask.on("state_changed", (snapshot) => {
				const thumbnailProgress =
					(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
				onProgress(80 + thumbnailProgress * 0.2);
			});

			await thumbnailTask;
			delete activeTasks[`${attachment.id}_thumbnail`];

			thumbnailUrl = await thumbnailRef.getDownloadURL();
			thumbnailStorageRef = thumbnailPath;
		}

		// Persist attachment metadata.
		const attachmentData = {
			id: attachment.id,
			name: attachment.name,
			type: attachment.type,
			size: attachment.size,
			storageRef: storagePath,
			downloadUrl,
			createdAt: new Date(),
			thumbnailUrl,
			thumbnailStorageRef,
		};

		await db
			.collection("Companies")
			.doc(companyId)
			.collection(parentType)
			.doc(parentId)
			.collection("Attachments")
			.doc(attachment.id)
			.set(attachmentData);

		return hasThumbnail
			? {
					...attachment,
					isExisting: true,
					uri: downloadUrl,
					thumbnailUri: thumbnailUrl || attachment.thumbnailUri,
				}
			: {
					...attachment,
					isExisting: true,
					uri: downloadUrl,
				};
	} finally {
		delete activeTasks[attachment.id];
		delete activeTasks[`${attachment.id}_thumbnail`];
	}
}

/**
 * Deletes an attachment's files from Storage and its metadata from Firestore.
 * Returns true if the attachment existed and was deleted.
 */
export async function deleteAttachment(
	attachmentId: string,
	companyId: string,
	parentId: string,
	parentType: AttachmentParentType,
): Promise<boolean> {
	const attachmentRef = db
		.collection("Companies")
		.doc(companyId)
		.collection(parentType)
		.doc(parentId)
		.collection("Attachments")
		.doc(attachmentId);

	const attachmentDoc = await attachmentRef.get();
	if (!attachmentDoc.exists) {
		return false;
	}

	const attachmentData = attachmentDoc.data();

	if (attachmentData?.storageRef) {
		await storage().ref(attachmentData.storageRef).delete();
	}

	if (attachmentData?.thumbnailStorageRef) {
		try {
			await storage().ref(attachmentData.thumbnailStorageRef).delete();
		} catch (thumbnailError) {
			console.warn("Could not delete thumbnail:", thumbnailError);
			// Continue with deletion even if thumbnail deletion fails.
		}
	}

	await attachmentRef.delete();
	return true;
}
