import React, {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import storage, { FirebaseStorageTypes } from "@react-native-firebase/storage";
import NetInfo from "@react-native-community/netinfo";
import {
	createAttachment,
	deleteAttachment,
	deleteForParent,
	getAttachmentsForParent,
	storagePathFor,
} from "../../services/v2/attachmentService";
import { AttachmentParentType, LocalAttachmentDraft } from "../../types/v2";

/*
 * Centralized Storage uploads and deletes.
 *
 * Storage orchestration is unchanged from v1 — sequential uploads, an 80/20
 * progress split when a thumbnail exists, cancellation on unmount, a NetInfo
 * gate. That code worked; there was no reason to rewrite it.
 *
 * What changed is that this file no longer touches Firestore. Attachment
 * metadata goes through attachmentService, which is what lets deletes cascade
 * and lets the Storage-orphan reconciliation sweep exist at all.
 */

type UploadStatus =
	"pending" | "uploading" | "complete" | "error" | "cancelled";

export type UploadProgressMap = Record<
	string,
	{ progress: number; status: UploadStatus; error?: string }
>;

type UploadManagerContextType = {
	uploadProgress: UploadProgressMap;
	isUploading: boolean;
	uploadFiles: (
		companyId: string,
		parentType: AttachmentParentType,
		parentId: string,
		attachments: LocalAttachmentDraft[],
		ownerUserId: string,
		fieldId?: string | null,
	) => Promise<string[]>;
	deleteAllForParent: (
		companyId: string,
		parentType: AttachmentParentType,
		parentId: string,
	) => Promise<void>;
	deleteAttachments: (
		companyId: string,
		parentType: AttachmentParentType,
		parentId: string,
		attachmentIds: string[],
	) => Promise<void>;
	cancelAll: () => void;
};

/*
 * The default value THROWS rather than no-oping.
 *
 * A default of `async () => []` means a missing provider looks like an upload
 * that succeeded and produced nothing — which is exactly how this went
 * unnoticed when the v2 harness was wired without the provider. A context whose
 * functions perform I/O has no safe default.
 */
const missingProvider = (method: string) => () => {
	throw new Error(
		`useUploadManager().${method} called outside UploadManagerProvider`,
	);
};

const UploadManagerContext = createContext<UploadManagerContextType>({
	uploadProgress: {},
	isUploading: false,
	uploadFiles: missingProvider("uploadFiles") as never,
	deleteAllForParent: missingProvider("deleteAllForParent") as never,
	deleteAttachments: missingProvider("deleteAttachments") as never,
	cancelAll: missingProvider("cancelAll"),
});

/** Thumbnails are derived by suffix, matching the v1 Storage layout exactly. */
const thumbnailPathFor = (path: string) => `${path}_thumbnail`;

export const UploadManagerProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	const [uploadProgress, setUploadProgress] = useState<UploadProgressMap>({});
	const [isUploading, setIsUploading] = useState(false);

	const activeTasks = useRef<Record<string, FirebaseStorageTypes.Task>>({});

	const cancelAll = useCallback(() => {
		for (const task of Object.values(activeTasks.current)) {
			try {
				task.cancel();
			} catch {
				// Already settled; nothing to cancel.
			}
		}
		activeTasks.current = {};
	}, []);

	// In-flight uploads are cancelled if the provider unmounts, so a backgrounded
	// app does not leave orphaned Storage objects with no metadata.
	useEffect(() => cancelAll, [cancelAll]);

	const setProgress = useCallback(
		(id: string, patch: Partial<UploadProgressMap[string]>) =>
			setUploadProgress((prev) => ({
				...prev,
				[id]: { progress: 0, status: "pending", ...prev[id], ...patch },
			})),
		[],
	);

	const uploadFiles = useCallback(
		async (
			companyId: string,
			parentType: AttachmentParentType,
			parentId: string,
			attachments: LocalAttachmentDraft[],
			ownerUserId: string,
			fieldId: string | null = null,
		): Promise<string[]> => {
			if (!attachments.length) return [];

			const net = await NetInfo.fetch();
			if (!net.isConnected) {
				throw new Error(
					"No internet connection. Try again when online.",
				);
			}

			setIsUploading(true);
			const uploaded: string[] = [];

			try {
				for (const attachment of attachments) {
					const hasThumbnail = Boolean(attachment.thumbnailUri);
					setProgress(attachment.id, { status: "uploading" });

					try {
						const path = storagePathFor(
							companyId,
							parentType,
							parentId,
							attachment.id,
						);
						const ref = storage().ref(path);
						const task = ref.putFile(attachment.uri);
						activeTasks.current[attachment.id] = task;

						// With a thumbnail the main file is worth 80% of the bar.
						task.on("state_changed", (snapshot) => {
							const pct =
								(snapshot.bytesTransferred /
									snapshot.totalBytes) *
								100;
							setProgress(attachment.id, {
								progress: hasThumbnail ? pct * 0.8 : pct,
							});
						});

						await task;
						delete activeTasks.current[attachment.id];

						const downloadUrl = await ref.getDownloadURL();

						let thumbnailPath: string | null = null;
						let thumbnailDownloadUrl: string | null = null;

						if (hasThumbnail && attachment.thumbnailUri) {
							thumbnailPath = thumbnailPathFor(path);
							const thumbRef = storage().ref(thumbnailPath);
							const thumbTask = thumbRef.putFile(
								attachment.thumbnailUri,
							);
							activeTasks.current[`${attachment.id}_thumbnail`] =
								thumbTask;

							thumbTask.on("state_changed", (snapshot) => {
								const pct =
									(snapshot.bytesTransferred /
										snapshot.totalBytes) *
									100;
								setProgress(attachment.id, {
									progress: 80 + pct * 0.2,
								});
							});

							await thumbTask;
							delete activeTasks.current[
								`${attachment.id}_thumbnail`
							];
							thumbnailDownloadUrl =
								await thumbRef.getDownloadURL();
						}

						// Metadata goes through the service, not straight to db.
						await createAttachment(companyId, {
							id: attachment.id,
							parentType,
							parentId,
							ownerUserId,
							fieldId,
							fileName: attachment.name,
							contentType: attachment.type,
							sizeBytes: attachment.size,
							width: attachment.width ?? null,
							height: attachment.height ?? null,
							storagePath: path,
							downloadUrl,
							thumbnailStoragePath: thumbnailPath,
							thumbnailDownloadUrl,
						});

						uploaded.push(attachment.id);
						setProgress(attachment.id, {
							progress: 100,
							status: "complete",
						});
					} catch (e: unknown) {
						const message =
							e instanceof Error ? e.message : String(e);
						const cancelled = message.includes("cancelled");
						setProgress(attachment.id, {
							status: cancelled ? "cancelled" : "error",
							error: message,
						});
						if (!cancelled) {
							console.error(
								`Upload failed for ${attachment.id}`,
								e,
							);
						}
					}
				}

				return uploaded;
			} finally {
				setIsUploading(false);
			}
		},
		[setProgress],
	);

	/** Deletes Storage objects for paths the service hands back. */
	const removeObjects = useCallback(async (paths: string[]) => {
		await Promise.all(
			paths.map(async (path) => {
				try {
					await storage().ref(path).delete();
				} catch (e) {
					// A missing object is fine — the metadata is gone either way,
					// and the reconciliation sweep reports true orphans.
					console.warn(`Could not delete storage object ${path}`, e);
				}
			}),
		);
	}, []);

	/**
	 * Removes every attachment for a parent.
	 *
	 * One query and one batch, then parallel Storage deletes. v1 looped
	 * sequentially, issuing a get, up to two Storage deletes and a delete per
	 * attachment.
	 */
	const deleteAllForParent = useCallback(
		async (
			companyId: string,
			parentType: AttachmentParentType,
			parentId: string,
		) => {
			const paths = await deleteForParent(
				companyId,
				parentType,
				parentId,
			);
			await removeObjects(paths);
		},
		[removeObjects],
	);

	const deleteAttachments = useCallback(
		async (
			companyId: string,
			parentType: AttachmentParentType,
			parentId: string,
			attachmentIds: string[],
		) => {
			if (!attachmentIds.length) return;

			const all = await getAttachmentsForParent(
				companyId,
				parentType,
				parentId,
			);
			const targets = all.filter((a) => attachmentIds.includes(a.id));

			await Promise.all(targets.map((a) => deleteAttachment(a.id)));

			await removeObjects(
				targets.flatMap(
					(a) =>
						[a.storagePath, a.thumbnailStoragePath].filter(
							Boolean,
						) as string[],
				),
			);
		},
		[removeObjects],
	);

	return (
		<UploadManagerContext.Provider
			value={{
				uploadProgress,
				isUploading,
				uploadFiles,
				deleteAllForParent,
				deleteAttachments,
				cancelAll,
			}}
		>
			{children}
		</UploadManagerContext.Provider>
	);
};

export const useUploadManager = () => useContext(UploadManagerContext);
