import React, {
	createContext,
	ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import storage, { FirebaseStorageTypes } from "@react-native-firebase/storage";
import {
	createPendingAttachment,
	deleteAttachment,
	deleteForParent,
	getAttachmentsForParent,
	markAttachmentUploaded,
	markAttachmentUploadFailed,
	storagePathFor,
} from "../services/attachmentService";
import { track } from "../services/offline/pendingWrites";
import { onReconnect } from "../lib/connectivity";
import {
	dequeue,
	dueItems,
	enqueue,
	loadQueue,
	markAttempt,
	MAX_ATTEMPTS,
	QueuedUpload,
	subscribeQueueSize,
} from "../lib/uploadQueue";
import {
	discardStaged,
	pruneOrphanedStaging,
	stageForUpload,
	stagedExists,
} from "../lib/uploadStaging";
import { AttachmentParentType, LocalAttachmentDraft } from "../types";

/*
 * Centralized Storage uploads and deletes.
 *
 * This file no longer touches Firestore — attachment metadata goes through
 * attachmentService, which is what lets deletes cascade and lets the
 * Storage-orphan reconciliation sweep exist at all.
 *
 * IT ALSO NO LONGER REFUSES TO WORK OFFLINE. It used to open with a
 * `NetInfo.fetch()` and throw "No internet connection. Try again when online."
 * — to a worker photographing a spill in a venue basement, whose only options
 * were to lose the photo or to stop working. Firestore's own writes had queued
 * happily beside it the whole time; Storage simply has no equivalent, so one
 * had to be built.
 *
 * The shape now is: stage the file somewhere durable, write the attachment
 * document immediately, put the bytes in a persisted queue, and drain that
 * queue whenever the network allows. `uploadFiles` returns straight away and
 * its returned ids are valid references from that instant — see
 * attachmentService.createPendingAttachment for why the document goes first.
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
	/** Files still waiting to leave the device. Survives a restart. */
	pendingUploads: number;
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
	/** Kicks the queue by hand, for a "retry now" affordance. */
	retryPending: () => Promise<void>;
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
	pendingUploads: 0,
	uploadFiles: missingProvider("uploadFiles") as never,
	deleteAllForParent: missingProvider("deleteAllForParent") as never,
	deleteAttachments: missingProvider("deleteAttachments") as never,
	retryPending: missingProvider("retryPending") as never,
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

	const [pendingUploads, setPendingUploads] = useState(0);

	const activeTasks = useRef<Record<string, FirebaseStorageTypes.Task>>({});
	/** Single-flight guard: one drain at a time, however many things kick it. */
	const draining = useRef(false);
	const appState = useRef(AppState.currentState);

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

	/*
	 * NOTHING IS CANCELLED ON UNMOUNT ANY MORE.
	 *
	 * This used to be `useEffect(() => cancelAll, [cancelAll])`, justified by
	 * not wanting orphaned Storage objects with no metadata. That reason is
	 * gone: the metadata document is written first now, so an interrupted
	 * upload leaves a visible, retryable "pending" record rather than an
	 * invisible orphan. Meanwhile the cancel itself was actively harmful — it
	 * killed every in-flight upload the moment the provider unmounted, which
	 * includes a user backgrounding the app to answer a text.
	 *
	 * Process death is handled by the queue, not by cancellation. cancelAll
	 * stays exported for a genuine user-initiated cancel.
	 */

	const setProgress = useCallback(
		(id: string, patch: Partial<UploadProgressMap[string]>) =>
			setUploadProgress((prev) => ({
				...prev,
				[id]: { progress: 0, status: "pending", ...prev[id], ...patch },
			})),
		[],
	);

	/** Pushes one file's bytes. Throws on failure so the caller can back off. */
	const sendOne = useCallback(
		async (item: QueuedUpload) => {
			const hasThumbnail = Boolean(item.thumbnailUri);
			setProgress(item.id, { status: "uploading" });

			const ref = storage().ref(item.storagePath);
			const task = ref.putFile(item.fileUri);
			activeTasks.current[item.id] = task;

			// With a thumbnail the main file is worth 80% of the bar.
			task.on("state_changed", (snapshot) => {
				const pct =
					(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
				setProgress(item.id, {
					progress: hasThumbnail ? pct * 0.8 : pct,
				});
			});

			await task;
			delete activeTasks.current[item.id];

			const downloadUrl = await ref.getDownloadURL();
			let thumbnailDownloadUrl: string | null = null;

			if (
				hasThumbnail &&
				item.thumbnailUri &&
				item.thumbnailStoragePath
			) {
				const thumbRef = storage().ref(item.thumbnailStoragePath);
				const thumbTask = thumbRef.putFile(item.thumbnailUri);
				activeTasks.current[`${item.id}_thumbnail`] = thumbTask;

				thumbTask.on("state_changed", (snapshot) => {
					const pct =
						(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
					setProgress(item.id, { progress: 80 + pct * 0.2 });
				});

				await thumbTask;
				delete activeTasks.current[`${item.id}_thumbnail`];
				thumbnailDownloadUrl = await thumbRef.getDownloadURL();
			}

			await markAttachmentUploaded(item.id, {
				downloadUrl,
				thumbnailDownloadUrl,
			});

			await dequeue(item.id);
			void discardStaged(item.fileUri);
			if (item.thumbnailUri) void discardStaged(item.thumbnailUri);

			setProgress(item.id, { progress: 100, status: "complete" });
		},
		[setProgress],
	);

	/**
	 * Gives up on an item for good.
	 *
	 * Only for failures that retrying cannot fix — the staged file is gone, the
	 * rules refuse, or we are out of attempts. Everything else stays queued,
	 * because the overwhelmingly common failure here is "no signal yet" and
	 * marking those failed would lose a photo to a tunnel.
	 */
	const failPermanently = useCallback(
		async (item: QueuedUpload, reason: string) => {
			console.error(
				`Upload failed permanently for ${item.id}: ${reason}`,
			);
			await dequeue(item.id);
			void discardStaged(item.fileUri);
			if (item.thumbnailUri) void discardStaged(item.thumbnailUri);
			track(
				"markAttachmentUploadFailed",
				markAttachmentUploadFailed(item.id, reason),
			);
			setProgress(item.id, { status: "error", error: reason });
		},
		[setProgress],
	);

	/**
	 * Works through everything whose backoff has elapsed.
	 *
	 * Sequential on purpose — this runs on a phone on cellular at a venue, and
	 * three concurrent photo uploads there are slower than one, not faster.
	 * Single-flight, because four different things kick it.
	 */
	const drain = useCallback(async () => {
		if (draining.current) return;
		draining.current = true;
		setIsUploading(true);

		try {
			const items = await dueItems();

			for (const item of items) {
				/*
				 * Checked before EVERY attempt, not just the first. The staged
				 * copy lives in documentDirectory, but a user can still clear
				 * app data, and a file that is not there will never be there.
				 */
				if (!(await stagedExists(item.fileUri))) {
					await failPermanently(
						item,
						"The file is no longer on this device",
					);
					continue;
				}

				try {
					await sendOne(item);
				} catch (e: unknown) {
					const message = e instanceof Error ? e.message : String(e);
					delete activeTasks.current[item.id];
					delete activeTasks.current[`${item.id}_thumbnail`];

					if (message.includes("cancelled")) {
						setProgress(item.id, {
							status: "cancelled",
							error: message,
						});
						continue;
					}

					// A rules refusal will refuse identically forever.
					if (message.includes("unauthorized")) {
						await failPermanently(item, message);
						continue;
					}

					const updated = await markAttempt(item.id, message);
					setProgress(item.id, { status: "error", error: message });

					if (updated && updated.attempts >= MAX_ATTEMPTS) {
						await failPermanently(updated, message);
					} else {
						/*
						 * Almost always just "we are offline". Stop the sweep
						 * rather than marching the whole queue into its next
						 * backoff tier for one shared cause.
						 */
						break;
					}
				}
			}
		} catch (e) {
			console.error("Upload drain failed", e);
		} finally {
			draining.current = false;
			setIsUploading(false);
		}
	}, [sendOne, setProgress, failPermanently]);

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

			const queued: QueuedUpload[] = [];

			for (const attachment of attachments) {
				const storagePath = storagePathFor(
					companyId,
					parentType,
					parentId,
					attachment.id,
				);

				/*
				 * Copy out of the picker's cache directory first — the OS
				 * reclaims that, and an upload waiting overnight would find
				 * nothing there. See uploadStaging.
				 */
				const fileUri = await stageForUpload(
					attachment.uri,
					attachment.id,
				);
				const thumbnailUri = attachment.thumbnailUri
					? await stageForUpload(
							attachment.thumbnailUri,
							`${attachment.id}_thumbnail`,
						)
					: null;

				const thumbnailStoragePath = thumbnailUri
					? thumbnailPathFor(storagePath)
					: null;

				/*
				 * The document, before the bytes. Not awaited: Firestore queues
				 * it offline, and the id is already valid either way.
				 */
				track(
					"createPendingAttachment",
					createPendingAttachment(companyId, {
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
						storagePath,
						thumbnailStoragePath,
						localUri: fileUri,
					}),
				);

				queued.push({
					id: attachment.id,
					companyId,
					parentType,
					parentId,
					ownerUserId,
					fieldId,
					fileUri,
					thumbnailUri,
					storagePath,
					thumbnailStoragePath,
					fileName: attachment.name,
					contentType: attachment.type,
					sizeBytes: attachment.size,
					width: attachment.width ?? null,
					height: attachment.height ?? null,
					attempts: 0,
					lastError: null,
					enqueuedAt: Date.now(),
					nextAttemptAt: 0,
				});

				setProgress(attachment.id, { status: "pending", progress: 0 });
			}

			await enqueue(queued);
			void drain();

			/*
			 * Every id, immediately — NOT just the ones whose bytes have landed.
			 * Callers treat this as "these attachments exist", and with the
			 * document written first that is now true from this moment. The old
			 * contract ("these uploaded") could not survive a deferred upload.
			 */
			return queued.map((item) => item.id);
		},
		[drain, setProgress],
	);

	/*
	 * What kicks the drain: mounting, reconnecting, and returning to the
	 * foreground. Deliberately no polling timer — there is nothing to poll for.
	 * Bytes only move when the network comes back or the app is in front, and
	 * both of those announce themselves.
	 */
	useEffect(() => {
		void drain();

		const stopWatchingNetwork = onReconnect(() => void drain());

		const subscription = AppState.addEventListener(
			"change",
			(next: AppStateStatus) => {
				const returnedToForeground =
					appState.current.match(/inactive|background/) &&
					next === "active";
				appState.current = next;
				if (returnedToForeground) void drain();
			},
		);

		return () => {
			stopWatchingNetwork();
			subscription.remove();
		};
	}, [drain]);

	/* The badge count. From the queue, so it is right after a force-quit too. */
	useEffect(() => subscribeQueueSize(setPendingUploads), []);

	/*
	 * Reclaim staged files nothing refers to any more.
	 *
	 * Full-resolution photos in documentDirectory, which is backed up to iCloud
	 * — so an upload that failed permanently, or was interrupted between the
	 * copy and the enqueue, costs the user storage twice until this runs.
	 */
	useEffect(() => {
		void loadQueue().then((items) =>
			pruneOrphanedStaging(
				items.flatMap(
					(item) =>
						[item.fileUri, item.thumbnailUri].filter(
							Boolean,
						) as string[],
				),
			),
		);
	}, []);

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
				pendingUploads,
				uploadFiles,
				deleteAllForParent,
				deleteAttachments,
				retryPending: drain,
				cancelAll,
			}}
		>
			{children}
		</UploadManagerContext.Provider>
	);
};

export const useUploadManager = () => useContext(UploadManagerContext);
