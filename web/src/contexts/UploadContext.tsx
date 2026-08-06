import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	getStorage,
	ref as storageRef,
	uploadBytesResumable,
	getDownloadURL,
	deleteObject,
	type UploadTask,
} from "firebase/storage";
import {
	createAttachment,
	deleteAttachment,
	deleteForParent,
	storagePathFor,
} from "@app/services/attachmentService";
import type { AttachmentParentType } from "@app/types";
import { app } from "../shim/firebaseApp";

/*
 * File uploads.
 *
 * The ONE part of the data layer that genuinely could not be shared. RNFirebase
 * uploads with `ref.putFile(uri)` — a path to a file on the device — and a
 * browser has no such thing; it uploads a File or Blob. So this mirrors
 * ../../src/contexts/UploadManagerContext.tsx's public API rather than its
 * implementation, and every screen-facing call looks the same.
 *
 * What IS shared, and matters more:
 *
 *   storagePathFor()   the exact object path the app writes to. Note the mixed
 *                      casing (companies/{cid}/Events/{id}/...) — it is
 *                      preserved from v1 because every existing record points
 *                      at it, and storage.rules matches on it.
 *   createAttachment() the Firestore metadata write. Identical document either
 *                      way, so a file uploaded here opens in the app.
 *
 * Uploads run SEQUENTIALLY, as the app's do. Parallel uploads from a browser on
 * a venue's wifi is how you get four half-finished files instead of one whole
 * one.
 *
 * ⚠ Browser uploads require CORS on the storage bucket. The mobile app never
 * needed it, so it is not configured yet — see web/cors.json.
 */

export type UploadStatus =
	"pending" | "uploading" | "complete" | "error" | "cancelled";

export type UploadProgress = {
	progress: number;
	status: UploadStatus;
	fileName: string;
	error?: string;
};

export type UploadProgressMap = Record<string, UploadProgress>;

type UploadContextValue = {
	uploadProgress: UploadProgressMap;
	isUploading: boolean;
	/** Returns the ids of the attachments that were created. */
	uploadFiles: (
		companyId: string,
		parentType: AttachmentParentType,
		parentId: string,
		files: File[],
		ownerUserId: string,
		fieldId?: string | null,
	) => Promise<string[]>;
	deleteAttachments: (
		companyId: string,
		parentType: AttachmentParentType,
		parentId: string,
		attachmentIds: string[],
	) => Promise<void>;
	deleteAllForParent: (
		companyId: string,
		parentType: AttachmentParentType,
		parentId: string,
	) => Promise<void>;
	cancelAll: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

/** Widest edge of a generated thumbnail. Matches the app's. */
const THUMB_MAX = 320;

/**
 * A thumbnail, drawn on a canvas.
 *
 * The app uses expo-image-manipulator; a browser already has this. Videos and
 * documents get no thumbnail — the gallery falls back to an icon, same as the
 * app.
 */
async function makeThumbnail(
	file: File,
): Promise<{ blob: Blob; width: number; height: number } | null> {
	if (!file.type.startsWith("image/")) return null;

	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(
			1,
			THUMB_MAX / Math.max(bitmap.width, bitmap.height),
		);
		const width = Math.round(bitmap.width * scale);
		const height = Math.round(bitmap.height * scale);

		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
		bitmap.close();

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", 0.7),
		);
		return blob ? { blob, width, height } : null;
	} catch {
		// A corrupt or unsupported image must not fail the upload itself.
		return null;
	}
}

/** Natural dimensions, so the gallery can lay out before the image loads. */
async function imageSize(
	file: File,
): Promise<{ width: number | null; height: number | null }> {
	if (!file.type.startsWith("image/")) return { width: null, height: null };
	try {
		const bitmap = await createImageBitmap(file);
		const size = { width: bitmap.width, height: bitmap.height };
		bitmap.close();
		return size;
	} catch {
		return { width: null, height: null };
	}
}

export function UploadProvider({ children }: { children: ReactNode }) {
	const [uploadProgress, setUploadProgress] = useState<UploadProgressMap>({});
	const tasks = useRef<Map<string, UploadTask>>(new Map());

	const update = useCallback((id: string, patch: Partial<UploadProgress>) => {
		setUploadProgress((current) => ({
			...current,
			[id]: { ...current[id], ...patch } as UploadProgress,
		}));
	}, []);

	const uploadFiles = useCallback<UploadContextValue["uploadFiles"]>(
		async (
			companyId,
			parentType,
			parentId,
			files,
			ownerUserId,
			fieldId = null,
		) => {
			if (!navigator.onLine) {
				throw new Error(
					"You appear to be offline. Try again once connected.",
				);
			}

			const created: string[] = [];

			for (const file of files) {
				// The attachment id IS the storage object name, so it has to be
				// decided before the upload starts.
				const attachmentId = crypto.randomUUID();
				const path = storagePathFor(
					companyId,
					parentType,
					parentId,
					attachmentId,
				);

				update(attachmentId, {
					progress: 0,
					status: "uploading",
					fileName: file.name,
				});

				try {
					const storage = getStorage(app);
					const task = uploadBytesResumable(
						storageRef(storage, path),
						file,
						{ contentType: file.type },
					);
					tasks.current.set(attachmentId, task);

					await new Promise<void>((resolve, reject) => {
						task.on(
							"state_changed",
							(snapshot) =>
								// 80/20 split with the thumbnail, matching the
								// app — a bar that hits 100% and then waits is
								// worse than one that is honest about the tail.
								update(attachmentId, {
									progress:
										(snapshot.bytesTransferred /
											snapshot.totalBytes) *
										0.8,
								}),
							reject,
							resolve,
						);
					});

					const downloadUrl = await getDownloadURL(task.snapshot.ref);
					update(attachmentId, { progress: 0.85 });

					/* ---- thumbnail, best effort ---- */
					let thumbnailStoragePath: string | null = null;
					let thumbnailDownloadUrl: string | null = null;

					const thumb = await makeThumbnail(file);
					if (thumb) {
						thumbnailStoragePath = `${path}_thumb`;
						const thumbTask = uploadBytesResumable(
							storageRef(storage, thumbnailStoragePath),
							thumb.blob,
							{ contentType: "image/jpeg" },
						);
						await thumbTask;
						thumbnailDownloadUrl = await getDownloadURL(
							thumbTask.snapshot.ref,
						);
					}

					update(attachmentId, { progress: 0.95 });

					const { width, height } = await imageSize(file);

					// The same Firestore write the app makes, so the resulting
					// document is byte-identical whichever client uploaded.
					await createAttachment(companyId, {
						id: attachmentId,
						parentType,
						parentId,
						ownerUserId,
						fieldId,
						fileName: file.name,
						contentType: file.type || "application/octet-stream",
						sizeBytes: file.size,
						width,
						height,
						storagePath: path,
						downloadUrl,
						thumbnailStoragePath,
						thumbnailDownloadUrl,
					});

					created.push(attachmentId);
					update(attachmentId, { progress: 1, status: "complete" });
				} catch (error) {
					const cancelled =
						(error as { code?: string })?.code ===
						"storage/canceled";
					update(attachmentId, {
						status: cancelled ? "cancelled" : "error",
						error: cancelled
							? undefined
							: error instanceof Error
								? error.message
								: String(error),
					});
					if (!cancelled) throw error;
				} finally {
					tasks.current.delete(attachmentId);
				}
			}

			return created;
		},
		[update],
	);

	const deleteAttachments = useCallback<
		UploadContextValue["deleteAttachments"]
	>(async (companyId, parentType, parentId, attachmentIds) => {
		const storage = getStorage(app);
		for (const attachmentId of attachmentIds) {
			const path = storagePathFor(
				companyId,
				parentType,
				parentId,
				attachmentId,
			);
			// Storage first, then metadata: a stray object with no document is
			// invisible clutter, but a document pointing at a deleted object is
			// a broken thumbnail on someone's screen.
			await deleteObject(storageRef(storage, path)).catch(() => {});
			await deleteObject(storageRef(storage, `${path}_thumb`)).catch(
				() => {},
			);
			await deleteAttachment(attachmentId);
		}
	}, []);

	const deleteAllForParent = useCallback<
		UploadContextValue["deleteAllForParent"]
	>(async (companyId, parentType, parentId) => {
		// The service returns the storage paths rather than deleting objects
		// itself — deliberately, so it stays platform-free. Cleaning them up is
		// this layer's job.
		const paths = await deleteForParent(companyId, parentType, parentId);
		const storage = getStorage(app);
		await Promise.all(
			paths.flatMap((path) => [
				deleteObject(storageRef(storage, path)).catch(() => {}),
				deleteObject(storageRef(storage, `${path}_thumb`)).catch(
					() => {},
				),
			]),
		);
	}, []);

	const cancelAll = useCallback(() => {
		for (const task of tasks.current.values()) task.cancel();
		tasks.current.clear();
	}, []);

	const isUploading = Object.values(uploadProgress).some(
		(entry) => entry.status === "uploading",
	);

	const value = useMemo<UploadContextValue>(
		() => ({
			uploadProgress,
			isUploading,
			uploadFiles,
			deleteAttachments,
			deleteAllForParent,
			cancelAll,
		}),
		[
			uploadProgress,
			isUploading,
			uploadFiles,
			deleteAttachments,
			deleteAllForParent,
			cancelAll,
		],
	);

	return (
		<UploadContext.Provider value={value}>
			{children}
		</UploadContext.Provider>
	);
}

export function useUploads(): UploadContextValue {
	const value = useContext(UploadContext);
	if (!value) {
		throw new Error("useUploads must be used inside <UploadProvider>");
	}
	return value;
}
