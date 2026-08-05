import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../../lib/db";
import { C, eventResponseId } from "../../constants/paths";
import { Event, WorkerVisibility } from "../../types/v2";
import { FilterType } from "../../types/enums/FilterType";
import { getMembersInGroups } from "./groupService";

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

	const audienceGroupIds = input.audienceGroupIds ?? [];
	const audienceUserIds = input.audienceUserIds ?? [];
	const isTargeted =
		audienceGroupIds.length > 0 || audienceUserIds.length > 0;

	await ref.set({
		...toPersisted(input),
		id: ref.id,
		companyId,
		assignedUserIds,
		assignedCount: assignedUserIds.length,
		attachmentCount: 0,
		audienceGroupIds,
		audienceUserIds,
		// Written explicitly, always. The open-availability query filters on
		// `isTargeted == false`, and an equality filter skips documents where
		// the field is absent — so an omitted `false` here is an event that
		// exists for nobody.
		isTargeted,
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

	/*
	 * The event document is already written by this point, so a fan-out failure
	 * cannot be reported as "creating the event failed" — the caller would
	 * retry and produce a duplicate.
	 *
	 * It also must not be swallowed: an event published to a group with no
	 * invitations behind it is invisible to exactly the people it was meant
	 * for, which is the failure this whole feature exists to prevent. So it is
	 * re-thrown under its own code, and the form tells the manager the event
	 * was saved but nobody has been asked yet. syncEventAudience is
	 * re-runnable, so re-saving fixes it.
	 */
	if (isTargeted) {
		try {
			await syncEventAudience(
				companyId,
				ref.id,
				(input.dateKey as string) ?? "",
				audienceGroupIds,
				audienceUserIds,
			);
		} catch {
			const error: any = new Error("Event saved, invitations not sent");
			error.code = "event/audience-not-notified";
			error.eventId = ref.id;
			throw error;
		}
	}

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

	/*
	 * Same pairing as assignedUserIds/assignedCount: the denormalized flag is
	 * derived here so it cannot drift from the lists it describes.
	 *
	 * Both lists have to be considered together — patching only the groups to
	 * empty on an event with individual invitees must NOT clear isTargeted, or
	 * the job would reappear for the whole company.
	 */
	if (patch.audienceGroupIds || patch.audienceUserIds) {
		update.isTargeted =
			(patch.audienceGroupIds ?? []).length > 0 ||
			(patch.audienceUserIds ?? []).length > 0;
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
 * Publishes an event by writing one invitation per targeted worker.
 *
 * The audience is the UNION of two things: everyone in the named groups, and
 * any individually named workers. Groups cover the standing case ("all
 * bartenders"); named users cover the one-off a group cannot express ("this
 * bartender, because they worked the venue last month"). Someone reachable
 * both ways is invited once — the set handles it.
 *
 * This is what enforces targeting. A restricted worker's availability screen
 * reads their own eventResponses, so a worker with no invitation has no
 * document to find — the event does not exist for them. That is a property of
 * the data, not a filter a future caller can forget to apply.
 *
 * Re-runnable. Invitations that already exist are left alone, so re-saving an
 * event never resets a reply that has already come in.
 *
 * Retraction is deliberately narrow: dropping a group or a name withdraws only
 * invitations nobody has answered yet. A worker who already confirmed or
 * declined keeps their response, because that answer is real information a
 * manager may be looking at.
 */
export async function syncEventAudience(
	companyId: string,
	eventId: string,
	dateKey: string,
	groupIds: string[],
	userIds: string[] = [],
): Promise<void> {
	try {
		const [members, existing] = await Promise.all([
			getMembersInGroups(companyId, groupIds),
			db
				.collection(C.eventResponses)
				.where("companyId", "==", companyId)
				.where("eventId", "==", eventId)
				.limit(DEFAULT_LIMIT)
				.get(),
		]);

		const invited = new Set([
			...members.map((m) => m.userId),
			...userIds.filter(Boolean),
		]);
		const byUser = new Map(
			existing.docs.map((doc) => [doc.data().userId as string, doc]),
		);

		const batch = db.batch();
		const now = firestore.FieldValue.serverTimestamp();
		let writes = 0;

		for (const userId of invited) {
			if (byUser.has(userId)) continue;
			const id = eventResponseId(eventId, userId);
			batch.set(db.collection(C.eventResponses).doc(id), {
				id,
				companyId,
				eventId,
				userId,
				dateKey,
				status: "pending",
				respondedAt: null,
				updatedAt: now,
				schemaVersion: 2,
			});
			writes += 1;
		}

		/*
		 * Retract only while there IS an audience.
		 *
		 * An empty audience means the event went back to being open to
		 * everyone, and an open event does not use invitations to control who
		 * sees it — so there is nothing to withdraw. Retracting anyway would
		 * delete every unanswered response on the event, and migrated records
		 * are exactly that shape (`status: "pending"`, `respondedAt: null`):
		 * a manager editing the date on an old event would silently erase the
		 * record that those workers had ever been asked.
		 */
		if (invited.size) {
			for (const [userId, doc] of byUser) {
				if (invited.has(userId)) continue;
				const data = doc.data();
				// Untouched invitation: nothing was said, so nothing is lost.
				if (data.status === "pending" && !data.respondedAt) {
					batch.delete(doc.ref);
					writes += 1;
				}
			}
		}

		if (writes) await batch.commit();
	} catch (e) {
		console.error("Error syncing event audience", e);
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
 * Upcoming events with nobody assigned that are open to the whole company.
 *
 * `assignedCount == 0` — v1 queried `assignedWorkers == []`, which only matches
 * a LITERAL empty array and silently missed every event where the field was
 * absent.
 *
 * `isTargeted == false` excludes events published to specific groups. Every
 * migrated event carries the field explicitly, because an equality filter does
 * not match documents where it is missing.
 */
export async function getOpenUpcomingEvents(
	companyId: string,
	fromDateKey: string,
): Promise<Event[]> {
	try {
		const snapshot = await db
			.collection(C.events)
			.where("companyId", "==", companyId)
			.where("assignedCount", "==", 0)
			.where("isTargeted", "==", false)
			.where("dateKey", ">=", fromDateKey)
			.orderBy("dateKey")
			.limit(DEFAULT_LIMIT)
			.get();
		return snapshot.docs.map(toEvent);
	} catch (e) {
		console.error("Error getting open events", e);
		return [];
	}
}

/**
 * Every upcoming event with nobody assigned, targeted or not.
 *
 * The manager view. Targeting decides who is ASKED about a job, not who may
 * oversee it — an owner needs to see every job still collecting availability,
 * including ones published to a group they are not personally in, or they
 * cannot tell that a contractor shift has gone unanswered.
 */
export async function getAllUnassignedUpcomingEvents(
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

/** Fetches events by id, chunked to Firestore's 30-value `in` limit. */
export async function getEventsByIds(
	companyId: string,
	eventIds: string[],
): Promise<Event[]> {
	if (!eventIds.length) return [];

	const unique = [...new Set(eventIds)];
	const chunks: string[][] = [];
	for (let i = 0; i < unique.length; i += 30) {
		chunks.push(unique.slice(i, i + 30));
	}

	try {
		const snapshots = await Promise.all(
			chunks.map((chunk) =>
				db
					.collection(C.events)
					.where("companyId", "==", companyId)
					.where(firestore.FieldPath.documentId(), "in", chunk)
					.get(),
			),
		);
		return snapshots.flatMap((s) => s.docs.map(toEvent));
	} catch (e) {
		console.error("Error getting events by id", e);
		return [];
	}
}

/**
 * The events to show on the availability screen.
 *
 * Three audiences, in order of breadth:
 *
 *   - a MANAGER sees every unassigned upcoming job, targeted or not. Targeting
 *     decides who is asked, not who may oversee; an owner who could not see a
 *     contractor shift could not tell it had gone unanswered.
 *   - an `open` worker sees every untargeted unassigned job — exactly v1 —
 *     plus anything they were specifically invited to.
 *   - a `restricted` worker sees only their invitations. That is the whole
 *     point of the flag: a 1099 contractor is shown the jobs meant for them
 *     and nothing else.
 *
 * `invitedEventIds` comes from the caller's own eventResponses, which the
 * security rules already scope to the signed-in user. Every branch is narrowed
 * to `assignedCount === 0`, because availability is about jobs nobody is on
 * yet; once staff are assigned the event belongs to the calendar.
 */
export async function getAvailabilityEvents(
	companyId: string,
	fromDateKey: string,
	visibility: WorkerVisibility,
	invitedEventIds: string[],
	isManager = false,
): Promise<Event[]> {
	const [open, invited] = await Promise.all([
		isManager
			? getAllUnassignedUpcomingEvents(companyId, fromDateKey)
			: visibility === "restricted"
				? Promise.resolve([] as Event[])
				: getOpenUpcomingEvents(companyId, fromDateKey),
		getEventsByIds(companyId, invitedEventIds),
	]);

	const byId = new Map<string, Event>();
	for (const event of [...open, ...invited]) {
		if (event.assignedCount !== 0) continue;
		if (event.dateKey < fromDateKey) continue;
		byId.set(event.id, event);
	}

	return [...byId.values()].sort((a, b) =>
		a.dateKey.localeCompare(b.dateKey),
	);
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
