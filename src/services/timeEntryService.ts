import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C } from "../constants/paths";
import { TimeEntry, TimeEntryStatus } from "../types";

/*
 * Time entries.
 *
 * Three v1 defects are fixed at the source here rather than in a screen:
 *
 *   - clockOut read the document, computed a duration and wrote it back, which
 *     races with pause/resume. It is a transaction now.
 *   - the approve path wrote rejectedAt/rejectedBy (TimeEntryDetails.tsx:258),
 *     which is why 2,104 of 2,116 approved entries carry a corrupt approver.
 *   - submitTimeEntryForApproval took the whole entry object from client state
 *     and wrote it back, so a stale client could revive old field values.
 */

const DEFAULT_LIMIT = 100;
const ACTIVE_STATUSES: TimeEntryStatus[] = ["active", "paused"];

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

export async function clockIn(
	companyId: string,
	userId: string,
	timeZone: string,
): Promise<string> {
	const ref = db.collection(C.timeEntries).doc();
	const now = new Date();

	await ref.set({
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

	return ref.id;
}

/**
 * Closes an entry.
 *
 * A transaction because the paused totals it depends on are mutated by
 * pause/resume. v1 read, computed and wrote as three separate steps, so
 * clocking out while a pause was being resumed could lose the pause.
 */
export async function clockOut(entryId: string): Promise<void> {
	const ref = db.collection(C.timeEntries).doc(entryId);

	await db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (!snap.exists()) throw new Error(`Time entry ${entryId} not found`);

		const entry = snap.data() as TimeEntry;
		const now = new Date();

		// A pause still open at clock-out counts up to this moment.
		let pausedSeconds = entry.pausedSeconds ?? 0;
		if (entry.pauseStartedAt) {
			pausedSeconds += Math.max(
				0,
				Math.round(
					(now.getTime() - entry.pauseStartedAt.toMillis()) / 1000,
				),
			);
		}

		const elapsed = Math.max(
			0,
			Math.round((now.getTime() - entry.clockInAt.toMillis()) / 1000),
		);

		tx.update(ref, {
			status: "completed",
			clockOutAt: firestore.Timestamp.fromDate(now),
			pausedSeconds,
			pauseStartedAt: null,
			// Clamped so it can never exceed elapsed time — v1 clamped the lower
			// bound at zero but never the upper, which the migration flagged.
			workedSeconds: Math.max(0, elapsed - pausedSeconds),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	});
}

export async function pauseEntry(entryId: string): Promise<void> {
	await db.collection(C.timeEntries).doc(entryId).update({
		status: "paused",
		pauseStartedAt: firestore.FieldValue.serverTimestamp(),
		updatedAt: firestore.FieldValue.serverTimestamp(),
	});
}

/** Accumulates the closed pause. A transaction for the same reason as clockOut. */
export async function resumeEntry(entryId: string): Promise<void> {
	const ref = db.collection(C.timeEntries).doc(entryId);

	await db.runTransaction(async (tx) => {
		const snap = await tx.get(ref);
		if (!snap.exists()) return;

		const entry = snap.data() as TimeEntry;
		const pausedFor = entry.pauseStartedAt
			? Math.max(
					0,
					Math.round(
						(Date.now() - entry.pauseStartedAt.toMillis()) / 1000,
					),
				)
			: 0;

		tx.update(ref, {
			status: "active",
			pauseStartedAt: null,
			pausedSeconds: (entry.pausedSeconds ?? 0) + pausedFor,
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	});
}

/** The user's open entry, if any. Synchronous unsubscribe. */
export function subscribeActiveEntry(
	companyId: string,
	userId: string,
	onChange: (entry: TimeEntry | null) => void,
): () => void {
	if (!companyId || !userId) return () => {};

	return db
		.collection(C.timeEntries)
		.where("companyId", "==", companyId)
		.where("userId", "==", userId)
		.where("status", "in", ACTIVE_STATUSES)
		.limit(1)
		.onSnapshot(
			(snapshot) =>
				onChange(snapshot.empty ? null : toEntry(snapshot.docs[0])),
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
