import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C } from "../constants/paths";
import { Attachment, AttachmentParentType } from "../types";

/*
 * Attachment metadata.
 *
 * Top-level rather than a subcollection of each parent, so that cascade deletes
 * and Storage-orphan reconciliation are single queries instead of a walk over
 * every event and every time entry. v1 had neither: deleting an event left its
 * Attachments subcollection behind permanently.
 *
 * UploadManagerContext owns the Storage side and calls in here for the
 * metadata; it no longer touches Firestore itself.
 */

const ATTACHMENT_LIMIT = 100;

const toAttachment = (
	doc: FirebaseFirestoreTypes.DocumentSnapshot,
): Attachment => ({ ...(doc.data() as Attachment), id: doc.id });

/**
 * Storage layout, preserved verbatim from v1.
 *
 * Note the casing: lowercase "companies", PascalCase parent segment. It is
 * inconsistent, and it stays that way — every existing storagePath points at
 * it, and renaming the objects would invalidate all 32 records for no benefit.
 */
const STORAGE_PARENT: Record<AttachmentParentType, string> = {
	event: "Events",
	timeEntry: "TimeEntries",
	timeEntryConnection: "TimeEntries",
};

export function storagePathFor(
	companyId: string,
	parentType: AttachmentParentType,
	parentId: string,
	attachmentId: string,
): string {
	return `companies/${companyId}/${STORAGE_PARENT[parentType]}/${parentId}/${attachmentId}`;
}

export async function createAttachment(
	companyId: string,
	input: Omit<
		Attachment,
		"companyId" | "createdAt" | "schemaVersion" | "storageVerifiedAt"
	>,
): Promise<void> {
	await db
		.collection(C.attachments)
		.doc(input.id)
		.set({
			...input,
			companyId,
			storageVerifiedAt: null,
			createdAt: firestore.FieldValue.serverTimestamp(),
			schemaVersion: 2,
		});
}

/*
 * The pending-upload lifecycle: create the document, then send the bytes.
 *
 * Storage has no offline queue, so uploads go through a persisted one
 * (src/lib/uploadQueue.ts) and can take minutes, hours, or a whole shift. The
 * metadata is written FIRST rather than after, which sounds backwards and is
 * the point:
 *
 *   - the id becomes a valid reference immediately, so a submitted form can
 *     cite the photo it just took. Deferring it meant every attachment silently
 *     vanished from the form it belonged to, since TimeEntrySubmitModal filters
 *     its answers down to the ids that came back.
 *   - Firestore queues THIS write offline for free, so the record survives.
 *   - the gallery can render the local file while the upload waits.
 *
 * It inverts the failure mode, which is the real win. Bytes-first left Storage
 * objects with no document pointing at them — invisible, and only findable by
 * the reconciliation sweep. Document-first leaves a document with no object,
 * which the schema already models (storageVerifiedAt, storageBroken) and which
 * the user can actually see and retry.
 */

export type PendingAttachmentInput = Omit<
	Attachment,
	| "companyId"
	| "createdAt"
	| "schemaVersion"
	| "storageVerifiedAt"
	| "downloadUrl"
	| "thumbnailDownloadUrl"
	| "uploadState"
> & { localUri: string };

/** Records a file the user has picked, before a byte has moved. Not awaited. */
export function createPendingAttachment(
	companyId: string,
	input: PendingAttachmentInput,
): Promise<void> {
	return db
		.collection(C.attachments)
		.doc(input.id)
		.set({
			...input,
			companyId,
			downloadUrl: null,
			thumbnailDownloadUrl: null,
			uploadState: "pending",
			uploadError: null,
			storageVerifiedAt: null,
			createdAt: firestore.FieldValue.serverTimestamp(),
			schemaVersion: 2,
		});
}

/** The bytes landed. Patches in the URLs and drops the local copy's path. */
export function markAttachmentUploaded(
	attachmentId: string,
	urls: { downloadUrl: string; thumbnailDownloadUrl: string | null },
): Promise<void> {
	return db.collection(C.attachments).doc(attachmentId).update({
		downloadUrl: urls.downloadUrl,
		thumbnailDownloadUrl: urls.thumbnailDownloadUrl,
		uploadState: "uploaded",
		uploadError: null,
		localUri: null,
	});
}

/**
 * The upload gave up for good.
 *
 * Only for PERMANENT failures — out of attempts, staged file gone, rules
 * refusal. A transient network error leaves the item "pending" so the queue
 * retries it; marking those failed would turn every tunnel into a lost photo.
 */
export function markAttachmentUploadFailed(
	attachmentId: string,
	reason: string,
): Promise<void> {
	return db
		.collection(C.attachments)
		.doc(attachmentId)
		.update({ uploadState: "failed", uploadError: reason });
}

export async function getAttachmentsForParent(
	companyId: string,
	parentType: AttachmentParentType,
	parentId: string,
): Promise<Attachment[]> {
	try {
		const snapshot = await db
			.collection(C.attachments)
			.where("companyId", "==", companyId)
			.where("parentType", "==", parentType)
			.where("parentId", "==", parentId)
			.limit(ATTACHMENT_LIMIT)
			.get();
		return snapshot.docs.map(toAttachment);
	} catch (e) {
		console.error("Error getting attachments", e);
		return [];
	}
}

export function subscribeAttachments(
	companyId: string,
	parentType: AttachmentParentType,
	parentId: string,
	onChange: (attachments: Attachment[]) => void,
): () => void {
	if (!companyId || !parentId) return () => {};

	return db
		.collection(C.attachments)
		.where("companyId", "==", companyId)
		.where("parentType", "==", parentType)
		.where("parentId", "==", parentId)
		.limit(ATTACHMENT_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(snapshot.docs.map(toAttachment)),
			(error) => console.error("Error subscribing to attachments", error),
		);
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
	await db.collection(C.attachments).doc(attachmentId).delete();
}

/**
 * Removes every attachment record for a parent, and returns the Storage paths
 * the caller must now delete.
 *
 * Returning the paths rather than deleting the objects here keeps this module
 * free of the Storage SDK — UploadManagerContext already owns that.
 */
export async function deleteForParent(
	companyId: string,
	parentType: AttachmentParentType,
	parentId: string,
): Promise<string[]> {
	const attachments = await getAttachmentsForParent(
		companyId,
		parentType,
		parentId,
	);
	if (!attachments.length) return [];

	const batch = db.batch();
	for (const attachment of attachments) {
		batch.delete(db.collection(C.attachments).doc(attachment.id));
	}
	await batch.commit();

	return attachments.flatMap((a) =>
		[a.storagePath, a.thumbnailStoragePath].filter(Boolean),
	) as string[];
}

/** Marks an attachment whose Storage object has gone missing. */
export async function markStorageBroken(attachmentId: string): Promise<void> {
	await db
		.collection(C.attachments)
		.doc(attachmentId)
		.update({ storageBroken: true });
}
