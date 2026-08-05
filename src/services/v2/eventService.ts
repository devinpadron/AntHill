import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../../lib/db";
import { C, eventResponseId } from "../../constants/paths";
import { Event } from "../../types/v2";
import { FilterType } from "../../types/enums/FilterType";

/*
 * Events.
 *
 * The change that matters: v1's subscribeAllEvents streamed the ENTIRE Events
 * collection and filtered by assignment and date in JavaScript
 * (usePullEvents.ts:25-116), so every user downloaded every event the company
 * had ever created on every calendar mount. That function is gone. Every query
 * here is filtered server-side, bounded by a date window, and limited.
 */

/** Firestore caps array-contains-any at 30 values. */
export const MAX_SELECTED_USERS = 30;

const DEFAULT_LIMIT = 300;

const toEvent = (doc: FirebaseFirestoreTypes.DocumentSnapshot): Event => ({
	...(doc.data() as Event),
	id: doc.id,
});

/*
 * What callers pass when writing an event.
 *
 * Instants arrive as plain Dates and `label` may be omitted — converting to
 * Timestamps and filling defaults belongs here, in the module that owns the
 * persisted shape, not in every form that writes one.
 */
export type EventWriteInput = Omit<
	Partial<Event>,
	"startAt" | "endAt" | "locations"
> & {
	startAt?: Date | null;
	endAt?: Date | null;
	locations?: Record<
		string,
		{ latitude: number; longitude: number; label?: string | null }
	>;
};

function toPersisted(input: EventWriteInput): Record<string, unknown> {
	const { startAt, endAt, locations, ...rest } = input;
	const out: Record<string, unknown> = { ...rest };

	if (startAt !== undefined) {
		out.startAt = startAt ? firestore.Timestamp.fromDate(startAt) : null;
	}
	if (endAt !== undefined) {
		out.endAt = endAt ? firestore.Timestamp.fromDate(endAt) : null;
	}
	if (locations !== undefined) {
		out.locations = Object.fromEntries(
			Object.entries(locations ?? {}).map(([address, value]) => [
				address,
				{
					latitude: value.latitude,
					longitude: value.longitude,
					label: value.label ?? null,
				},
			]),
		);
	}

	return out;
}

export type EventWindow = {
	/** Inclusive "YYYY-MM-DD". */
	from: string;
	/** Inclusive "YYYY-MM-DD". */
	to: string;
	filter: FilterType;
	/** Required for FilterType.MY. */
	userId?: string;
	/** Required for FilterType.SPECIFIC. */
	selectedUsers?: string[];
	limit?: number;
};

/**
 * Builds the query for a filter. One shape per FilterType, each backed by a
 * composite index declared in firestore.indexes.json.
 *
 * Returns null when the filter cannot match anything (SPECIFIC with nobody
 * selected), so callers can skip the round trip entirely — v1 fetched
 * everything and then returned [].
 */
function buildQuery(
	companyId: string,
	window: EventWindow,
): FirebaseFirestoreTypes.Query | null {
	const limit = window.limit ?? DEFAULT_LIMIT;

	let query: FirebaseFirestoreTypes.Query = db
		.collection(C.events)
		.where("companyId", "==", companyId);

	switch (window.filter) {
		case FilterType.MY:
			if (!window.userId) return null;
			query = query.where(
				"assignedUserIds",
				"array-contains",
				window.userId,
			);
			break;

		case FilterType.UNASSIGNED:
			// v1 queried `assignedWorkers == []`, which only matches a literal
			// empty array and silently missed every event where the field was
			// absent. assignedCount is always present and always correct.
			query = query.where("assignedCount", "==", 0);
			break;

		case FilterType.SPECIFIC: {
			const users = (window.selectedUsers ?? []).slice(
				0,
				MAX_SELECTED_USERS,
			);
			if (!users.length) return null;
			// "at least one of" — the strictest server-side filter available.
			// `allSelected` and `exactSelected` are subsets of this and get
			// refined in JS over the (now tiny) result set.
			query = query.where("assignedUserIds", "array-contains-any", users);
			break;
		}

		case FilterType.ALL:
		default:
			break;
	}

	return query
		.where("dateKey", ">=", window.from)
		.where("dateKey", "<=", window.to)
		.orderBy("dateKey")
		.limit(limit);
}

/**
 * Refines SPECIFIC's sub-modes, which cannot be expressed server-side.
 * Operates on the already-narrow result set.
 */
export function refineSelection(
	events: Event[],
	selectedUsers: string[],
	{
		allSelected,
		exactSelected,
	}: { allSelected?: boolean; exactSelected?: boolean },
): Event[] {
	if (!selectedUsers.length) return events;

	if (exactSelected) {
		return events.filter(
			(e) =>
				e.assignedCount === selectedUsers.length &&
				selectedUsers.every((uid) => e.assignedUserIds.includes(uid)),
		);
	}
	if (allSelected) {
		return events.filter((e) =>
			selectedUsers.every((uid) => e.assignedUserIds.includes(uid)),
		);
	}
	return events;
}

/**
 * Live events for a date window. Returns the unsubscribe function
 * synchronously — v1's subscribe helpers were `async`, so they returned a
 * Promise that callers stored and never called, leaking a listener on every
 * dependency change.
 */
export function subscribeEventsInRange(
	companyId: string,
	window: EventWindow,
	onChange: (events: Event[]) => void,
	onError?: (error: Error) => void,
): () => void {
	if (!companyId) return () => {};

	const query = buildQuery(companyId, window);
	if (!query) {
		onChange([]);
		return () => {};
	}

	return query.onSnapshot(
		(snapshot) => onChange(snapshot.docs.map(toEvent)),
		(error) => {
			// A missing composite index surfaces as failed-precondition, and the
			// console's creation URL is in the message. v1 swallowed this and
			// returned [], so a missing index looked like "no events".
			console.error("Error subscribing to events", error);
			onError?.(error);
		},
	);
}

export async function getEventsInRange(
	companyId: string,
	window: EventWindow,
): Promise<Event[]> {
	const query = buildQuery(companyId, window);
	if (!query) return [];

	try {
		const snapshot = await query.get();
		return snapshot.docs.map(toEvent);
	} catch (e) {
		console.error("Error getting events", e);
		return [];
	}
}

export async function getEvent(eventId: string): Promise<Event | null> {
	try {
		const doc = await db.collection(C.events).doc(eventId).get();
		return doc.exists ? toEvent(doc) : null;
	} catch (e) {
		console.error("Error getting event", e);
		return null;
	}
}

export function subscribeEvent(
	eventId: string,
	onChange: (event: Event | null) => void,
): () => void {
	if (!eventId) return () => {};

	return db
		.collection(C.events)
		.doc(eventId)
		.onSnapshot(
			(doc) => onChange(doc.exists ? toEvent(doc) : null),
			(error) => console.error("Error subscribing to event", error),
		);
}

/** Creates an event in ONE write. v1 did add() then update({id}). */
export async function createEvent(
	companyId: string,
	input: EventWriteInput,
	createdBy: string,
): Promise<string> {
	const ref = db.collection(C.events).doc();
	const now = firestore.FieldValue.serverTimestamp();
	const assignedUserIds = input.assignedUserIds ?? [];

	await ref.set({
		...toPersisted(input),
		id: ref.id,
		companyId,
		assignedUserIds,
		assignedCount: assignedUserIds.length,
		attachmentCount: 0,
		responseCounts: {
			confirmed: 0,
			declined: 0,
			pending: assignedUserIds.length,
		},
		createdAt: now,
		createdBy,
		updatedAt: now,
		updatedBy: createdBy,
		schemaVersion: 2,
	});

	return ref.id;
}

/**
 * Patches an event. Never accepts a whole document — v1's saveNotes wrote
 * `{...event, userNotes}` back, clobbering any concurrent admin edit.
 *
 * `assignedCount` is kept in step with `assignedUserIds` here so the two can
 * never drift.
 */
export async function updateEvent(
	eventId: string,
	patch: EventWriteInput,
	updatedBy: string,
): Promise<void> {
	const update: Record<string, unknown> = {
		...toPersisted(patch),
		updatedAt: firestore.FieldValue.serverTimestamp(),
		updatedBy,
	};

	if (patch.assignedUserIds) {
		update.assignedCount = patch.assignedUserIds.length;
	}

	try {
		await db.collection(C.events).doc(eventId).update(update);
	} catch (e) {
		console.error("Error updating event", e);
		throw e;
	}
}

/**
 * Deletes an event and everything that hangs off it.
 *
 * v1's deleteEvent removed only the event document, orphaning its Attachments
 * and Checklists subcollections permanently.
 */
export async function deleteEvent(
	companyId: string,
	eventId: string,
): Promise<void> {
	try {
		const [responses, attachments] = await Promise.all([
			db
				.collection(C.eventResponses)
				.where("companyId", "==", companyId)
				.where("eventId", "==", eventId)
				.get(),
			db
				.collection(C.attachments)
				.where("companyId", "==", companyId)
				.where("parentType", "==", "event")
				.where("parentId", "==", eventId)
				.get(),
		]);

		const batch = db.batch();
		batch.delete(db.collection(C.events).doc(eventId));
		batch.delete(db.collection(C.eventChecklistStates).doc(eventId));
		for (const doc of responses.docs) batch.delete(doc.ref);
		for (const doc of attachments.docs) batch.delete(doc.ref);

		await batch.commit();
	} catch (e) {
		console.error("Error deleting event", e);
		throw e;
	}
}

/**
 * Records a worker's availability or assignment response.
 *
 * One document per (event, user), written whole. v1 read the event, spread its
 * workerStatus map and wrote it back — three separate read-modify-write races
 * in availabilityService, where two workers responding at once lost one
 * response.
 */
export async function setEventResponse(
	companyId: string,
	eventId: string,
	userId: string,
	status: "pending" | "confirmed" | "declined",
	dateKey: string,
): Promise<void> {
	const id = eventResponseId(eventId, userId);

	try {
		await db.collection(C.eventResponses).doc(id).set(
			{
				id,
				companyId,
				eventId,
				userId,
				dateKey,
				status,
				respondedAt: firestore.FieldValue.serverTimestamp(),
				updatedAt: firestore.FieldValue.serverTimestamp(),
				schemaVersion: 2,
			},
			{ merge: true },
		);
	} catch (e) {
		console.error("Error setting event response", e);
		throw e;
	}
}

/** Every response for an event, keyed by user. One query. */
export async function getEventResponses(
	companyId: string,
	eventId: string,
): Promise<Record<string, string>> {
	try {
		const snapshot = await db
			.collection(C.eventResponses)
			.where("companyId", "==", companyId)
			.where("eventId", "==", eventId)
			.limit(DEFAULT_LIMIT)
			.get();

		const byUser: Record<string, string> = {};
		for (const doc of snapshot.docs) {
			const data = doc.data();
			byUser[data.userId] = data.status;
		}
		return byUser;
	} catch (e) {
		console.error("Error getting event responses", e);
		return {};
	}
}

export function subscribeEventResponses(
	companyId: string,
	eventId: string,
	onChange: (responses: Record<string, string>) => void,
): () => void {
	if (!companyId || !eventId) return () => {};

	return db
		.collection(C.eventResponses)
		.where("companyId", "==", companyId)
		.where("eventId", "==", eventId)
		.onSnapshot(
			(snapshot) => {
				const byUser: Record<string, string> = {};
				for (const doc of snapshot.docs) {
					const data = doc.data();
					byUser[data.userId] = data.status;
				}
				onChange(byUser);
			},
			(error) => console.error("Error subscribing to responses", error),
		);
}

/**
 * Upcoming events with nobody assigned — the availability flow.
 *
 * Uses `assignedCount == 0`. v1 queried `assignedWorkers == []`, which only
 * matches a LITERAL empty array and silently missed every event where the field
 * was absent.
 */
export async function getUnassignedUpcomingEvents(
	companyId: string,
	fromDateKey: string,
): Promise<Event[]> {
	try {
		const snapshot = await db
			.collection(C.events)
			.where("companyId", "==", companyId)
			.where("assignedCount", "==", 0)
			.where("dateKey", ">=", fromDateKey)
			.orderBy("dateKey")
			.limit(DEFAULT_LIMIT)
			.get();
		return snapshot.docs.map(toEvent);
	} catch (e) {
		console.error("Error getting unassigned events", e);
		return [];
	}
}

/**
 * Every response this user has given, keyed by event.
 *
 * One query. v1 read the whole event document to pull one entry out of its
 * workerStatus map, per event.
 */
export function subscribeMyResponses(
	companyId: string,
	userId: string,
	fromDateKey: string,
	onChange: (byEventId: Record<string, string>) => void,
): () => void {
	if (!companyId || !userId) return () => {};

	return db
		.collection(C.eventResponses)
		.where("companyId", "==", companyId)
		.where("userId", "==", userId)
		.where("dateKey", ">=", fromDateKey)
		.limit(DEFAULT_LIMIT)
		.onSnapshot(
			(snapshot) => {
				const byEventId: Record<string, string> = {};
				for (const doc of snapshot.docs) {
					const data = doc.data();
					byEventId[data.eventId] = data.status;
				}
				onChange(byEventId);
			},
			(error) =>
				console.error("Error subscribing to my responses", error),
		);
}

/** Upcoming events a user is assigned to. Replaces availabilityService. */
export function subscribeMyUpcomingEvents(
	companyId: string,
	userId: string,
	fromDateKey: string,
	onChange: (events: Event[]) => void,
): () => void {
	if (!companyId || !userId) return () => {};

	return db
		.collection(C.events)
		.where("companyId", "==", companyId)
		.where("assignedUserIds", "array-contains", userId)
		.where("dateKey", ">=", fromDateKey)
		.orderBy("dateKey")
		.limit(DEFAULT_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(snapshot.docs.map(toEvent)),
			(error) => console.error("Error subscribing to my events", error),
		);
}
