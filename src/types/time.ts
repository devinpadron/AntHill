import { BaseDoc, CompanyScoped, DateKey, Timestamp } from "./common";
import { FormResponses } from "./forms";
import { LocationTrackSummary } from "./location";

export type TimeEntryStatus =
	| "active"
	| "paused"
	| "completed"
	| "edited"
	| "pending_approval"
	| "approved"
	| "rejected";

/**
 * How much to trust `review.decidedBy`.
 *
 * v1's approve path wrote `rejectedAt`/`rejectedBy` (a bug — see
 * TimeEntryDetails.tsx), and `approvedBy`/`approvedAt` were never written by
 * any code path. For historical records the approver is therefore INFERRED
 * from the status field, and that inference cannot be validated against
 * anything. Surface it in the UI rather than presenting it as fact.
 */
export type ReviewProvenance =
	"trusted" | "inferred_from_status_bug" | "unknown";

export interface TimeEntryReview {
	decision: "approved" | "rejected";
	decidedBy: string | null;
	decidedAt: Timestamp | null;
	reason: string | null;
	provenance: ReviewProvenance;
}

/** timeEntries/{entryId} */
export interface TimeEntry extends BaseDoc, CompanyScoped {
	userId: string;
	status: TimeEntryStatus;
	clockInAt: Timestamp;
	clockOutAt: Timestamp | null;
	/** Local day of clockInAt — payroll groups by it. */
	dateKey: DateKey;
	/** Was `duration`. */
	workedSeconds: number | null;
	pausedSeconds: number;
	pauseStartedAt: Timestamp | null;
	notes: string;

	/** Refs, not the two full embedded schema copies v1 wrote per entry. */
	formSchemaIds: {
		timeEntry: string | null;
		event: string | null;
	};
	/** Guards against a published schema being mutated after the fact. */
	formSchemaHashes: {
		timeEntry: string | null;
		event: string | null;
	};
	formResponses: FormResponses;

	connectionCount: number;
	editCount: number;

	submission: {
		submittedAt: Timestamp;
		notes: string;
	} | null;

	review: TimeEntryReview | null;

	/**
	 * The shift's location track, or the reason there isn't one.
	 *
	 * NULL on every entry recorded before the feature existed, and on every
	 * entry from a company that has it switched off. Null means "nobody was
	 * asked to record this" and must render as nothing at all — it is not the
	 * same as a track that came back empty, which `status` distinguishes.
	 */
	locationTracking: LocationTrackSummary | null;

	/**
	 * The raw v1 approval fields, copied verbatim. The `review` inference above
	 * is lossy and irreversible, so the source data travels with it. Never read
	 * by the app.
	 */
	legacy: {
		approvedBy?: string;
		approvedAt?: string;
		rejectedBy?: string;
		rejectedAt?: string;
	} | null;
}

/**
 * timeEntries/{entryId}/connections/{connectionId}
 *
 * connectionId is the eventId for real events, or `custom_{timestamp}` for the
 * ad-hoc entries the submit modal allows. `eventId` is null for those, so
 * downstream code no longer has to pattern-match on an ID prefix — v1 wrote
 * `custom-` but filtered on `custom_`, so the filter never matched.
 */
export interface TimeEntryConnection extends CompanyScoped {
	id: string;
	entryId: string;
	userId: string;
	eventId: string | null;
	customTitle: string | null;
	eventTitleSnapshot: string;
	formResponses: FormResponses;
	createdAt: Timestamp;
	schemaVersion: number;
}

/**
 * timeEntries/{entryId}/edits/{editId}
 *
 * Replaces v1's `editHistory` array, which had three different writer shapes
 * and a renderer that read a fourth key set no writer ever produced. One shape,
 * one writer, and appending no longer rewrites an unbounded array.
 *
 * editId = `${entryId}-${seq padded to 4}` so re-running the migration is
 * idempotent.
 */
export interface TimeEntryEdit extends CompanyScoped {
	id: string;
	entryId: string;
	at: Timestamp;
	actorUserId: string | null;
	actorDisplayName: string | null;
	summary: string;
	before: {
		clockInAt: Timestamp | null;
		clockOutAt: Timestamp | null;
		workedSeconds: number | null;
		notes: string | null;
		formResponses: FormResponses | null;
	} | null;
	source: "editSheet" | "detailsField" | "legacy_unknown";
	seq: number;
	schemaVersion: number;
}
