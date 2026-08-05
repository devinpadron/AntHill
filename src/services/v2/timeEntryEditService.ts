import firestore from "@react-native-firebase/firestore";
import db from "../../lib/db";
import { C } from "../../constants/paths";
import { TimeEntryEdit, TimeEntryConnection } from "../../types/v2";

/*
 * The audit trail on a time entry.
 *
 * v1 kept this as an `editHistory` array on the entry, appended by three call
 * sites that each wrote a DIFFERENT shape, while the renderer read a fourth key
 * set (`userName`/`changeSummary`) that no writer ever produced — which is why
 * edit history has never displayed an author for any record.
 *
 * One shape, one writer, and appending no longer rewrites an unbounded array.
 * The rules make these documents create-only: an audit trail that can be
 * rewritten is not an audit trail.
 */

const EDIT_LIMIT = 100;

const editId = (entryId: string, seq: number) =>
	`${entryId}-${String(seq).padStart(4, "0")}`;

export type EditInput = {
	summary: string;
	actorUserId: string;
	actorDisplayName: string;
	before?: TimeEntryEdit["before"];
};

/**
 * Appends an edit and bumps the entry's counter atomically.
 *
 * `seq` comes from the entry's `editCount`, read inside the transaction, so two
 * simultaneous edits cannot collide on an id or lose a count.
 */
export async function appendEdit(
	companyId: string,
	entryId: string,
	input: EditInput,
): Promise<void> {
	const entryRef = db.collection(C.timeEntries).doc(entryId);

	await db.runTransaction(async (tx) => {
		const snap = await tx.get(entryRef);
		if (!snap.exists()) throw new Error(`Time entry ${entryId} not found`);

		const seq = snap.data()?.editCount ?? 0;
		const ref = entryRef.collection(C.edits).doc(editId(entryId, seq));

		tx.set(ref, {
			id: ref.id,
			companyId,
			entryId,
			at: firestore.FieldValue.serverTimestamp(),
			actorUserId: input.actorUserId,
			actorDisplayName: input.actorDisplayName,
			summary: input.summary,
			before: input.before ?? null,
			source: "editSheet",
			seq,
			schemaVersion: 2,
		});

		tx.update(entryRef, {
			editCount: firestore.FieldValue.increment(1),
			status: "edited",
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	});
}

export async function getEdits(entryId: string): Promise<TimeEntryEdit[]> {
	try {
		const snapshot = await db
			.collection(C.timeEntries)
			.doc(entryId)
			.collection(C.edits)
			.orderBy("seq")
			.limit(EDIT_LIMIT)
			.get();
		return snapshot.docs.map((d) => ({
			...(d.data() as TimeEntryEdit),
			id: d.id,
		}));
	} catch (e) {
		console.error("Error getting edits", e);
		return [];
	}
}

/* ---------------------------------------------------------------- connections */

export type ConnectionInput = {
	/** null for an ad-hoc job the worker typed in. */
	eventId: string | null;
	title: string;
	userId: string;
	formResponses?: Record<string, unknown>;
};

/**
 * Replaces an entry's connections wholesale.
 *
 * Ad-hoc connections get `eventId: null` and a `custom_` id, so nothing
 * downstream has to pattern-match an id prefix — v1 wrote `custom-` and
 * filtered on `custom_`, so 1,984 connections were never excluded from the
 * package lookups they were meant to skip.
 */
export async function setConnections(
	companyId: string,
	entryId: string,
	connections: ConnectionInput[],
): Promise<void> {
	const entryRef = db.collection(C.timeEntries).doc(entryId);
	const existing = await entryRef.collection(C.connections).limit(200).get();

	const batch = db.batch();
	for (const doc of existing.docs) batch.delete(doc.ref);

	connections.forEach((connection, index) => {
		const id = connection.eventId ?? `custom_${Date.now()}_${index}`;
		batch.set(entryRef.collection(C.connections).doc(id), {
			id,
			companyId,
			entryId,
			userId: connection.userId,
			eventId: connection.eventId,
			customTitle: connection.eventId ? null : connection.title,
			eventTitleSnapshot: connection.title,
			formResponses: connection.formResponses ?? {},
			createdAt: firestore.FieldValue.serverTimestamp(),
			schemaVersion: 2,
		});
	});

	batch.update(entryRef, {
		connectionCount: connections.length,
		updatedAt: firestore.FieldValue.serverTimestamp(),
	});

	await batch.commit();
}

/**
 * Patches ONE connection's answers.
 *
 * v1 rebuilt the whole connectedEvents array on the parent document for a
 * single field change, which is a read-modify-write over an unbounded array.
 */
export async function updateConnectionResponses(
	entryId: string,
	connectionId: string,
	formResponses: Record<string, unknown>,
): Promise<void> {
	await db
		.collection(C.timeEntries)
		.doc(entryId)
		.collection(C.connections)
		.doc(connectionId)
		.update({ formResponses });
}

export async function getConnections(
	entryId: string,
): Promise<TimeEntryConnection[]> {
	try {
		const snapshot = await db
			.collection(C.timeEntries)
			.doc(entryId)
			.collection(C.connections)
			.limit(200)
			.get();
		return snapshot.docs.map((d) => ({
			...(d.data() as TimeEntryConnection),
			id: d.id,
		}));
	} catch (e) {
		console.error("Error getting connections", e);
		return [];
	}
}
