import { CompanyScoped, Timestamp } from "./common";

export type AttachmentParentType =
	"event" | "timeEntry" | "timeEntryConnection";

/**
 * attachments/{attachmentId} — top-level, shared across parent types.
 *
 * Flat rather than a subcollection of each parent so that orphan
 * reconciliation and cascade deletes are single queries instead of a walk over
 * every event and every time entry. v1 had neither: deleting an event left its
 * Attachments subcollection behind, and attachment docs missing `storageRef`
 * left Storage objects with nothing pointing at them.
 *
 * `companyId` and `ownerUserId` are denormalized so the security rules never
 * need a get() on the parent.
 */
export interface Attachment extends CompanyScoped {
	id: string;
	parentType: AttachmentParentType;
	parentId: string;
	ownerUserId: string;
	/** Set when the file came from a form field rather than a plain upload. */
	fieldId: string | null;

	fileName: string;
	contentType: string;
	sizeBytes: number;
	width: number | null;
	height: number | null;

	/**
	 * NOTE the casing: Storage paths are `companies/{cid}/{Events|TimeEntries}/...`
	 * — lowercase collection segment, PascalCase parent segment. Preserved
	 * verbatim from v1 because every existing record points at it; renaming the
	 * objects would invalidate all of them for no benefit.
	 */
	storagePath: string;
	downloadUrl: string;
	thumbnailStoragePath: string | null;
	thumbnailDownloadUrl: string | null;

	/** Set by the reconciliation sweep; drives its resumability. */
	storageVerifiedAt: Timestamp | null;
	/** True when the Storage object is gone — render a placeholder, not a spinner. */
	storageBroken?: boolean;

	createdAt: Timestamp;
	schemaVersion: number;
}

/**
 * A file the user has picked but not yet uploaded.
 *
 * Kept separate from `Attachment` on purpose: v1 conflated the two in a single
 * `AttachmentItem` interface, which is why the gallery needed
 * `downloadUrl || uri` fallbacks at five different call sites.
 */
export interface LocalAttachmentDraft {
	id: string;
	uri: string;
	name: string;
	type: string;
	size: number;
	width?: number;
	height?: number;
	thumbnailUri?: string | null;
}
