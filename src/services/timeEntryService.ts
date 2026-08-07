import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C } from "../constants/paths";
import { SnapshotSync, TimeEntry, TimeEntryStatus } from "../types";
import { track } from "./offline/pendingWrites";

/*
 * Time entries.
 *
 * Three v1 defects are fixed at the source here rather than in a screen:
 *
 *   - clockOut read the document, computed a duration and wrote it back, which
 *     races with pause/resume.
 *   - the approve path wrote rejectedAt/rejectedBy (TimeEntryDetails.tsx:258),
 *     which is why 2,104 of 2,116 approved entries carry a corrupt approver.
 *   - submitTimeEntryForApproval took the whole entry object from client state
 *     and wrote it back, so a stale client could revive old field values.
 *
 * THE CLOCK WORKS OFFLINE. That constraint shapes the four functions below, and
 * it is worth understanding before changing them.
 *
 * Staff clock in at venues with no signal. Firestore's native persistence
 * already handles most of this — writes land on disk, raise their snapshot
 * immediately, and replay when the network returns, surviving a force-quit. Two
 * things fought it:
 *
 *   1. A TRANSACTION CANNOT RUN OFFLINE. tx.get() issues a BatchGetDocuments
 *      RPC straight to the datastore, bypassing the cache and the mutation
 *      queue. clockOut and resumeEntry were transactions, so ending a shift
 *      with no signal burned the SDK's retries and then failed outright. They
 *      now compute from the entry the caller already holds — the live
 *      subscribeActiveEntry snapshot — and write plainly.
 *
 *      The cost, stated plainly because the old comment promised otherwise:
 *      two devices clocking out at the same instant no longer serialize, and
 *      the last absolute write wins. resumeEntry avoids that with
 *      FieldValue.increment, a transform the server applies to whatever the
 *      document actually holds; clockOut cannot, because it needs the absolute
 *      total to derive workedSeconds. One user, one open entry, usually one
 *      device — an acceptable trade for a clock that works in a basement.
 *
 *   2. AN AWAITED WRITE HANGS OFFLINE. The promise from set()/update() resolves
 *      on SERVER acknowledgement, not on the local write. Awaiting it left the
 *      UI's isBusy flag stuck true forever with no toast and no way out. These
 *      functions are therefore SYNCHRONOUS: they return once the write is
 *      queued, and hand the promise to pendingWrites.track() so a genuine
 *      rejection is still reported.
 *
 * Business timestamps are client-side (Timestamp.fromDate) and must stay that
 * way. serverTimestamp() reads as NULL in every local snapshot — the serializer
 * defaults serverTimestampBehavior to "none" — so a pause stamped by the server
 * is invisible to the device that made it until it syncs, which silently
 * dropped in-progress pauses from the paid total. createdAt/updatedAt stay on
 * serverTimestamp deliberately: nothing in the app reads them, and the server's
 * value is the better audit record.
 */

const DEFAULT_LIMIT = 100;
const ACTIVE_STATUSES: TimeEntryStatus[] = ["active", "paused"];

/** Per-round-trip size and overall ceiling for `getAllTimeEntries`. */
const SWEEP_PAGE_SIZE = 200;
const MAX_HISTORY = 2000;

const toEntry = (doc: FirebaseFirestoreTypes.DocumentSnapshot): TimeEntry => ({
	...(doc.data() as TimeEntry),
	id: doc.id,
});

/** "YYYY-MM-DD" for an instant in the company's zone. */
export function dateKeyFor(date: Date, timeZone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

/**
 * Opens an entry. Returns its id immediately — the write is not awaited.
 *
 * The id comes from a client-generated auto-id, so it is known before anything
 * touches the network and the caller can reference the entry straight away.
 */
export function clockIn(
	companyId: string,
	userId: string,
	timeZone: string,
): string {
	const ref = db.collection(C.timeEntries).doc();
	const now = new Date();

	const write = ref.set({
		id: ref.id,
		companyId,
		userId,
		status: "active",
		clockInAt: firestore.Timestamp.fromDate(now),
		clockOutAt: null,
		dateKey: dateKeyFor(now, timeZone),
		workedSeconds: null,
		pausedSeconds: 0,
		pauseStartedAt: null,
		notes: "",
		formSchemaIds: { timeEntry: null, event: null },
		formSchemaHashes: { timeEntry: null, event: null },
		formResponses: {},
		connectionCount: 0,
		editCount: 0,
		submission: null,
		review: null,
		legacy: null,
		createdAt: firestore.FieldValue.serverTimestamp(),
		updatedAt: firestore.FieldValue.serverTimestamp(),
		schemaVersion: 2,
	});

	track("clockIn", write);
	return ref.id;
}

/** The fields clockOut needs. Satisfied by the live subscribeActiveEntry snapshot. */
export type ClockOutInput = Pick<
	TimeEntry,
	"id" | "clockInAt" | "pausedSeconds" | "pauseStartedAt"
>;

/**
 * Closes an entry.
 *
 * Takes the entry rather than its id so it never has to read one back — see the
 * offline note at the top of this file. `at` exists for tests; production always
 * means "now".
 */
export function clockOut(entry: ClockOutInput, at: Date = new Date()): void {
	const now = at.getTime();

	// A pause still open at clock-out counts up to this moment.
	let pausedSeconds = entry.pausedSeconds ?? 0;
	if (entry.pauseStartedAt) {
		pausedSeconds += Math.max(
			0,
			Math.round((now - entry.pauseStartedAt.toMillis()) / 1000),
		);
	}

	const elapsed = Math.max(
		0,
		Math.round((now - entry.clockInAt.toMillis()) / 1000),
	);

	const write = db
		.collection(C.timeEntries)
		.doc(entry.id)
		.update({
			status: "completed",
			clockOutAt: firestore.Timestamp.fromDate(at),
			/*
			 * Absolute, not an increment: workedSeconds below is derived from
			 * this exact total, so the two must agree. This is the write that
			 * loses a genuine two-device race.
			 */
			pausedSeconds,
			pauseStartedAt: null,
			// Clamped so it can never exceed elapsed time — v1 clamped the lower
			// bound at zero but never the upper, which the migration flagged.
			workedSeconds: Math.max(0, elapsed - pausedSeconds),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

	track("clockOut", write);
}

/** Convenience for a caller without the entry in hand. Reads, then closes. */
export async function clockOutById(entryId: string): Promise<void> {
	const entry = await getTimeEntry(entryId);
	if (!entry) throw new Error(`Time entry ${entryId} not found`);
	clockOut(entry);
}

export function pauseEntry(entryId: string, at: Date = new Date()): void {
	const write = db
		.collection(C.timeEntries)
		.doc(entryId)
		.update({
			status: "paused",
			/*
			 * A CLIENT timestamp, deliberately. serverTimestamp() reads back as
			 * null locally, so the device that paused could not see its own pause:
			 * the worked-time counter kept climbing through the break, and clockOut
			 * found no open pause to bank. That was wrong online too, not just off.
			 */
			pauseStartedAt: firestore.Timestamp.fromDate(at),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

	track("pauseEntry", write);
}

/** The fields resumeEntry needs. */
export type ResumeInput = Pick<TimeEntry, "id" | "pauseStartedAt">;

/**
 * Banks the pause that just ended.
 *
 * Uses FieldValue.increment rather than an absolute total. It is a transform:
 * it queues offline like any write, and the server applies it to whatever the
 * document actually holds — so two devices resuming do not clobber each other's
 * banked time. That recovers most of what the old transaction guaranteed.
 */
export function resumeEntry(entry: ResumeInput, at: Date = new Date()): void {
	const pausedFor = entry.pauseStartedAt
		? Math.max(
				0,
				Math.round(
					(at.getTime() - entry.pauseStartedAt.toMillis()) / 1000,
				),
			)
		: 0;

	const write = db
		.collection(C.timeEntries)
		.doc(entry.id)
		.update({
			status: "active",
			pauseStartedAt: null,
			pausedSeconds: firestore.FieldValue.increment(pausedFor),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});

	track("resumeEntry", write);
}

/**
 * The user's open entry, if any. Synchronous unsubscribe.
 *
 * Reports snapshot freshness as a trailing argument, following the
 * `onChange(events, cursor)` shape eventService.subscribeEventsInRange already
 * uses. The clock is the one screen that needs it: it is the only place a user
 * acts offline and needs to know the action was kept.
 *
 * `includeMetadataChanges` is REQUIRED for that, not an optimisation. An
 * acknowledgement does not change the document, so without it no further
 * snapshot is raised and hasPendingWrites stays stuck true forever. Safe here
 * because this is a limit(1) query; do NOT copy it onto list subscriptions.
 */
export function subscribeActiveEntry(
	companyId: string,
	userId: string,
	onChange: (entry: TimeEntry | null, sync: SnapshotSync) => void,
): () => void {
	if (!companyId || !userId) return () => {};

	return db
		.collection(C.timeEntries)
		.where("companyId", "==", companyId)
		.where("userId", "==", userId)
		.where("status", "in", ACTIVE_STATUSES)
		.limit(1)
		.onSnapshot(
			{ includeMetadataChanges: true },
			(snapshot) =>
				onChange(snapshot.empty ? null : toEntry(snapshot.docs[0]), {
					fromCache: snapshot.metadata.fromCache,
					hasPendingWrites: snapshot.metadata.hasPendingWrites,
				}),
			(error) =>
				console.error("Error subscribing to active entry", error),
		);
}

export type EntryQuery = {
	/** Omit to query across the whole company (payroll review). */
	userId?: string;
	status?: TimeEntryStatus[];
	/** Inclusive "YYYY-MM-DD" bounds on dateKey. */
	from?: string;
	to?: string;
	limit?: number;
	startAfter?: FirebaseFirestoreTypes.DocumentSnapshot;
};

function buildEntryQuery(
	companyId: string,
	options: EntryQuery,
): FirebaseFirestoreTypes.Query {
	let query: FirebaseFirestoreTypes.Query = db
		.collection(C.timeEntries)
		.where("companyId", "==", companyId);

	if (options.userId) query = query.where("userId", "==", options.userId);
	if (options.status?.length) {
		query = query.where("status", "in", options.status.slice(0, 10));
	}
	if (options.from) query = query.where("dateKey", ">=", options.from);
	if (options.to) query = query.where("dateKey", "<=", options.to);

	query = query
		.orderBy("dateKey", "desc")
		.limit(options.limit ?? DEFAULT_LIMIT);
	if (options.startAfter) query = query.startAfter(options.startAfter);

	return query;
}

/**
 * A page of entries plus the cursor for the next one. v1 returned every
 * matching entry with no bound — the comments claiming "and limit results"
 * were aspirational.
 */
export async function getTimeEntries(
	companyId: string,
	options: EntryQuery = {},
): Promise<{
	entries: TimeEntry[];
	cursor: FirebaseFirestoreTypes.DocumentSnapshot | null;
}> {
	try {
		const snapshot = await buildEntryQuery(companyId, options).get();
		return {
			entries: snapshot.docs.map(toEntry),
			cursor: snapshot.docs.length
				? snapshot.docs[snapshot.docs.length - 1]
				: null,
		};
	} catch (e) {
		console.error("Error getting time entries", e);
		return { entries: [], cursor: null };
	}
}

/**
 * Every entry matching `options`, paged internally.
 *
 * For the places that need a whole history rather than a screenful — the
 * statistics page totals a user's entire time at a company, which no single
 * bounded query can answer.
 *
 * Still bounded: each round trip carries its own `.limit()`, and the sweep
 * stops at MAX_HISTORY. `truncated` says the cap was hit, so a caller can
 * qualify the figure rather than present a partial total as complete. The
 * underlying query orders by `dateKey` DESC, so a truncated sweep drops the
 * OLDEST records, which is the right end to lose.
 */
export async function getAllTimeEntries(
	companyId: string,
	options: EntryQuery = {},
): Promise<{ entries: TimeEntry[]; truncated: boolean }> {
	if (!companyId) return { entries: [], truncated: false };

	const entries: TimeEntry[] = [];
	let cursor: FirebaseFirestoreTypes.DocumentSnapshot | undefined;

	try {
		while (entries.length < MAX_HISTORY) {
			const snapshot = await buildEntryQuery(companyId, {
				...options,
				limit: SWEEP_PAGE_SIZE,
				startAfter: cursor,
			}).get();

			entries.push(...snapshot.docs.map(toEntry));

			// A short page is the end of the collection, not a coincidence.
			if (snapshot.docs.length < SWEEP_PAGE_SIZE) {
				return { entries, truncated: false };
			}
			cursor = snapshot.docs[snapshot.docs.length - 1];
		}

		return { entries: entries.slice(0, MAX_HISTORY), truncated: true };
	} catch (e) {
		console.error("Error sweeping time entries", e);
		// Partial beats empty here — a total over most of the history is still
		// worth showing, as long as it is labelled truncated.
		return { entries, truncated: entries.length > 0 };
	}
}

export function subscribeTimeEntries(
	companyId: string,
	options: EntryQuery,
	onChange: (entries: TimeEntry[]) => void,
): () => void {
	if (!companyId) return () => {};

	return buildEntryQuery(companyId, options).onSnapshot(
		(snapshot) => onChange(snapshot.docs.map(toEntry)),
		(error) => console.error("Error subscribing to time entries", error),
	);
}

export async function getTimeEntry(entryId: string): Promise<TimeEntry | null> {
	try {
		const doc = await db.collection(C.timeEntries).doc(entryId).get();
		return doc.exists() ? toEntry(doc) : null;
	} catch (e) {
		console.error("Error getting time entry", e);
		return null;
	}
}

/**
 * Submits for approval.
 *
 * Takes an explicit patch, never the whole entry. v1 passed the entire object
 * from client state, which meant a device holding a stale copy could resurrect
 * superseded values on submit.
 */
export async function submitForApproval(
	entryId: string,
	patch: {
		notes?: string;
		formResponses?: Record<string, unknown>;
		formSchemaIds?: { timeEntry: string | null; event: string | null };
		formSchemaHashes?: { timeEntry: string | null; event: string | null };
		submissionNotes?: string;
	},
): Promise<void> {
	const { submissionNotes, ...rest } = patch;

	await db
		.collection(C.timeEntries)
		.doc(entryId)
		.update({
			...rest,
			status: "pending_approval",
			submission: {
				submittedAt: firestore.FieldValue.serverTimestamp(),
				notes: submissionNotes ?? "",
			},
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
}

/**
 * Approves entries.
 *
 * THIS IS WHERE THE v1 BUG IS FIXED. TimeEntryDetails.tsx:258-261 wrote
 * `{status:"approved", rejectedAt, rejectedBy}` — approvedBy/approvedAt were
 * never written by any code path. Recording the decision belongs in a service,
 * not in a screen, which is why it drifted for so long.
 *
 * New decisions are always `provenance: "trusted"`; only migrated historical
 * records carry the inferred value.
 */
export async function approveEntries(
	entryIds: string[],
	decidedBy: string,
): Promise<void> {
	await writeReview(entryIds, {
		decision: "approved",
		decidedBy,
		reason: null,
	});
}

export async function rejectEntries(
	entryIds: string[],
	decidedBy: string,
	reason: string,
): Promise<void> {
	await writeReview(entryIds, { decision: "rejected", decidedBy, reason });
}

async function writeReview(
	entryIds: string[],
	review: {
		decision: "approved" | "rejected";
		decidedBy: string;
		reason: string | null;
	},
): Promise<void> {
	if (!entryIds.length) return;

	// Batched rather than the sequential per-entry loop v1 used, so a bulk
	// approval is one round trip and cannot half-apply.
	const chunks: string[][] = [];
	for (let i = 0; i < entryIds.length; i += 400) {
		chunks.push(entryIds.slice(i, i + 400));
	}

	for (const chunk of chunks) {
		const batch = db.batch();
		const now = firestore.FieldValue.serverTimestamp();

		for (const id of chunk) {
			batch.update(db.collection(C.timeEntries).doc(id), {
				status: review.decision,
				review: {
					decision: review.decision,
					decidedBy: review.decidedBy,
					decidedAt: now,
					reason: review.reason,
					provenance: "trusted",
				},
				updatedAt: now,
			});
		}

		await batch.commit();
	}
}

export async function updateTimeEntry(
	entryId: string,
	patch: Partial<TimeEntry>,
): Promise<void> {
	await db
		.collection(C.timeEntries)
		.doc(entryId)
		.update({
			...patch,
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
}

/** Deletes an entry and its subcollections and attachments. */
export async function deleteTimeEntry(
	companyId: string,
	entryId: string,
): Promise<void> {
	const ref = db.collection(C.timeEntries).doc(entryId);

	const [connections, edits, attachments] = await Promise.all([
		ref.collection(C.connections).get(),
		ref.collection(C.edits).get(),
		db
			.collection(C.attachments)
			.where("companyId", "==", companyId)
			.where("parentType", "==", "timeEntry")
			.where("parentId", "==", entryId)
			.get(),
	]);

	const batch = db.batch();
	for (const doc of connections.docs) batch.delete(doc.ref);
	for (const doc of edits.docs) batch.delete(doc.ref);
	for (const doc of attachments.docs) batch.delete(doc.ref);
	batch.delete(ref);

	await batch.commit();
}
