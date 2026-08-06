import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C, eventResponseId } from "../constants/paths";
import { Event, EventResponse, WorkerVisibility } from "../types";
import { FilterType } from "../types/enums/FilterType";
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

/**
 * Most events any one query returns.
 *
 * Exported because the cap is not invisible to callers: results are ordered by
 * `dateKey` ASCENDING, so hitting it drops the LATEST events in the window, not
 * the least relevant ones. A UI that widens its date range needs to be able to
 * tell "nothing more is scheduled" from "more is scheduled than we fetched".
 */
export const EVENT_QUERY_LIMIT = 300;

const DEFAULT_LIMIT = EVENT_QUERY_LIMIT;

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
	/**
	 * Inclusive "YYYY-MM-DD". OMIT for an open-ended forward range.
	 *
	 * A grid has to know both edges of what it is drawing. A list paging
	 * forward does not, and giving it a `to` is what makes a schedule appear to
	 * stop on an arbitrary date — page size, not a date, is what should bound
	 * an infinite list.
	 */
	to?: string;
	filter: FilterType;
	/** Required for FilterType.MY. */
	userId?: string;
	/** Required for FilterType.SPECIFIC. */
	selectedUsers?: string[];
	limit?: number;
	/** Page cursor — the last document of the previous page. */
	startAfter?: FirebaseFirestoreTypes.DocumentSnapshot;
};

/**
 * The filter clauses only — no ordering, cursor or limit.
 *
 * Split out because `count()` needs exactly this and nothing else: Firestore
 * APPLIES a `limit()` to an aggregation, so counting through `buildQuery` would
 * answer "how big is one page" rather than "how many are there".
 *
 * One shape per FilterType, each backed by a composite index declared in
 * firestore.indexes.json. Returns null when the filter cannot match anything
 * (SPECIFIC with nobody selected), so callers can skip the round trip entirely
 * — v1 fetched everything and then returned [].
 */
function buildFilteredQuery(
	companyId: string,
	window: EventWindow,
): FirebaseFirestoreTypes.Query | null {
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

	query = query.where("dateKey", ">=", window.from);
	if (window.to) query = query.where("dateKey", "<=", window.to);

	return query;
}

/** One ordered, cursored, limited page. */
function buildQuery(
	companyId: string,
	window: EventWindow,
): FirebaseFirestoreTypes.Query | null {
	const filtered = buildFilteredQuery(companyId, window);
	if (!filtered) return null;

	let query = filtered.orderBy("dateKey");
	if (window.startAfter) query = query.startAfter(window.startAfter);

	return query.limit(window.limit ?? DEFAULT_LIMIT);
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
	/**
	 * `cursor` is the last document of this page, for callers paging past it.
	 * Additive second argument — existing callers ignore it.
	 */
	onChange: (
		events: Event[],
		cursor: FirebaseFirestoreTypes.DocumentSnapshot | null,
	) => void,
	onError?: (error: Error) => void,
): () => void {
	if (!companyId) return () => {};

	const query = buildQuery(companyId, window);
	if (!query) {
		onChange([], null);
		return () => {};
	}

	return query.onSnapshot(
		(snapshot) =>
			onChange(
				snapshot.docs.map(toEvent),
				snapshot.docs[snapshot.docs.length - 1] ?? null,
			),
		(error) => {
			// A missing composite index surfaces as failed-precondition, and the
			// console's creation URL is in the message. v1 swallowed this and
			// returned [], so a missing index looked like "no events".
			console.error("Error subscribing to events", error);
			onError?.(error);
		},
	);
}

/**
 * An opaque page cursor.
 *
 * Aliased here so callers can hold one without importing Firestore themselves —
 * `tools/check-layering.sh` rule 1 forbids hooks and screens from reaching the
 * SDK, and a type-only import is still an import.
 */
export type EventCursor = FirebaseFirestoreTypes.DocumentSnapshot;

export type EventPage = {
	events: Event[];
	/** Feed back as `window.startAfter` to fetch the next page. */
	cursor: FirebaseFirestoreTypes.DocumentSnapshot | null;
	/**
	 * A full page came back, so there is probably another. False is definitive;
	 * true is a "keep going", not a promise — the next page may be empty when
	 * the total is an exact multiple of the page size.
	 */
	hasMore: boolean;
};

/**
 * One page of events, with the cursor to continue from.
 *
 * The unit of an infinite list. Callers accumulate pages themselves rather than
 * re-running a widening query, which re-read and re-rendered everything already
 * on screen every time the range grew.
 */
export async function getEventPage(
	companyId: string,
	window: EventWindow,
): Promise<EventPage> {
	const query = buildQuery(companyId, window);
	if (!query) return { events: [], cursor: null, hasMore: false };

	const size = window.limit ?? DEFAULT_LIMIT;

	try {
		const snapshot = await query.get();
		return {
			events: snapshot.docs.map(toEvent),
			cursor: snapshot.docs[snapshot.docs.length - 1] ?? null,
			hasMore: snapshot.docs.length === size,
		};
	} catch (e) {
		console.error("Error getting event page", e);
		return { events: [], cursor: null, hasMore: false };
	}
}

/**
 * How many events match, without reading them.
 *
 * Billed per index entry rather than per document, so a schedule of any size
 * can be totalled for roughly the price of one read. This is what lets a
 * counter say how many events there ARE rather than how many happen to be
 * loaded.
 *
 * Returns null on failure, which callers must distinguish from 0 — showing
 * "0 events" because an aggregation failed is worse than showing nothing.
 */
export async function countEventsInRange(
	companyId: string,
	window: EventWindow,
): Promise<number | null> {
	const query = buildFilteredQuery(companyId, window);
	if (!query) return 0;

	try {
		const snapshot = await query.count().get();
		return snapshot.data().count;
	} catch (e) {
		console.error("Error counting events", e);
		return null;
	}
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
		return doc.exists() ? toEvent(doc) : null;
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
			(doc) => onChange(doc.exists() ? toEvent(doc) : null),
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

	/*
	 * Anyone assigned at creation needs a record to acknowledge against.
	 *
	 * Best-effort rather than fatal, unlike the audience above: a missing
	 * invitation means a worker never learns the job exists, but a missing
	 * acknowledgement record only means they are not yet prompted, and the
	 * event still shows in their upcoming list. Re-saving repairs it.
	 */
	if (assignedUserIds.length) {
		await ensureAssignmentRecords(
			companyId,
			ref.id,
			(input.dateKey as string) ?? "",
			assignedUserIds,
		).catch((e) =>
			console.error("Assignment records not created for new event", e),
		);
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

	/*
	 * Newly assigned workers need a record to acknowledge against. Only when
	 * the patch actually touches the crew — an edit to the title must not
	 * write eventResponses.
	 *
	 * `dateKey` may not be in the patch, so it is read back when needed rather
	 * than assumed; a record stamped with the wrong day would drop out of the
	 * worker's `dateKey >=` query and be invisible.
	 */
	if (patch.assignedUserIds?.length) {
		try {
			// One read. companyId is never in the patch, and dateKey only
			// sometimes is, so the saved document is the reliable source for
			// both.
			const saved = await getEvent(eventId);
			if (saved?.companyId && saved.dateKey) {
				await ensureAssignmentRecords(
					saved.companyId,
					eventId,
					saved.dateKey,
					patch.assignedUserIds,
				);
			}
		} catch (e) {
			console.error("Assignment records not updated", e);
		}
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
/**
 * Makes sure every ASSIGNED worker has an eventResponses document.
 *
 * Until this existed, that document was created only for the audience — the
 * people who were ASKED. Someone merely assigned had none, which had two
 * consequences:
 *
 *   1. `responseCounts.pending` counted them (createEvent seeds it from
 *      assignedUserIds.length) while no document backed the count, so an event
 *      could report "5 awaiting reply" that nobody could ever answer.
 *   2. There was nowhere to record that they had SEEN the assignment.
 *
 * Records created here start with `status: "pending"` and a null
 * `acknowledgedAt`. The status is not a question being asked — assignment is
 * not an invitation — it is just the neutral value; what matters on these is
 * the acknowledgement.
 *
 * Existing documents are left completely alone. Someone who already answered
 * the availability question keeps their answer when they are later assigned.
 */
export async function ensureAssignmentRecords(
	companyId: string,
	eventId: string,
	dateKey: string,
	assignedUserIds: string[],
): Promise<void> {
	if (!assignedUserIds.length) return;

	try {
		const existing = await db
			.collection(C.eventResponses)
			.where("companyId", "==", companyId)
			.where("eventId", "==", eventId)
			.limit(DEFAULT_LIMIT)
			.get();

		const known = new Set(
			existing.docs.map((doc) => doc.data().userId as string),
		);

		const batch = db.batch();
		const now = firestore.FieldValue.serverTimestamp();
		let writes = 0;

		for (const userId of new Set(assignedUserIds.filter(Boolean))) {
			if (known.has(userId)) continue;
			const id = eventResponseId(eventId, userId);
			batch.set(db.collection(C.eventResponses).doc(id), {
				id,
				companyId,
				eventId,
				userId,
				dateKey,
				status: "pending",
				respondedAt: null,
				acknowledgedAt: null,
				updatedAt: now,
				schemaVersion: 2,
			});
			writes += 1;
		}

		if (writes) await batch.commit();
	} catch (e) {
		console.error("Error ensuring assignment records", e);
		throw e;
	}
}

/**
 * "I have seen that I am working this."
 *
 * Separate from setEventResponse, which answers the availability question.
 * Clearing a previously flagged problem is deliberate: acknowledging is how a
 * worker withdraws a flag they raised by mistake.
 */
export async function acknowledgeAssignment(
	companyId: string,
	eventId: string,
	userId: string,
	dateKey: string,
): Promise<void> {
	const id = eventResponseId(eventId, userId);
	try {
		await db
			.collection(C.eventResponses)
			.doc(id)
			.set(
				{
					id,
					companyId,
					eventId,
					userId,
					dateKey,
					acknowledgedAt: firestore.FieldValue.serverTimestamp(),
					updatedAt: firestore.FieldValue.serverTimestamp(),
					schemaVersion: 2,
				},
				// mergeFields, so acknowledging never disturbs `status` — the
				// availability answer and the acknowledgement are independent.
				{
					mergeFields: [
						"id",
						"companyId",
						"eventId",
						"userId",
						"dateKey",
						"acknowledgedAt",
						"updatedAt",
						"schemaVersion",
					],
				},
			);
	} catch (e) {
		console.error("Error acknowledging assignment", e);
		throw e;
	}
}

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
				// Present and null from the start, so a document never has to
				// be distinguished by which fields it happens to carry.
				acknowledgedAt: null,
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

/**
 * The full response documents for an event, keyed by user.
 *
 * subscribeEventResponses below flattens each document to its `status`, which
 * was everything the availability screens needed. Acknowledgement lives on the
 * same document in different fields, so anything showing whether an assigned
 * worker has SEEN their shift needs the whole record.
 *
 * Added alongside rather than replacing: the flattened form is what the app's
 * availability screens consume, and widening their payload would make every
 * one of them re-render on an acknowledgement they do not display.
 */
export function subscribeEventResponseDocs(
	companyId: string,
	eventId: string,
	onChange: (byUserId: Record<string, EventResponse>) => void,
): () => void {
	if (!companyId || !eventId) return () => {};

	return db
		.collection(C.eventResponses)
		.where("companyId", "==", companyId)
		.where("eventId", "==", eventId)
		.limit(DEFAULT_LIMIT)
		.onSnapshot(
			(snapshot) => {
				const byUserId: Record<string, EventResponse> = {};
				for (const doc of snapshot.docs) {
					const data = doc.data() as EventResponse;
					byUserId[data.userId] = { ...data, id: doc.id };
				}
				onChange(byUserId);
			},
			(error) =>
				console.error("Error subscribing to response docs", error),
		);
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

/**
 * This user's own response documents, in full.
 *
 * Same query as subscribeMyResponses — and therefore the same index — but
 * without flattening to `status`. The acknowledgement fields live on these
 * documents, and "which of my shifts have I not confirmed seeing" cannot be
 * answered from the status alone.
 *
 * Filtering for unacknowledged happens in JS rather than with an
 * `acknowledgedAt == null` clause on purpose: that would need a fourth field in
 * the composite index for a list that is only ever a handful of documents.
 */
export function subscribeMyResponseDocs(
	companyId: string,
	userId: string,
	fromDateKey: string,
	onChange: (byEventId: Record<string, EventResponse>) => void,
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
				const byEventId: Record<string, EventResponse> = {};
				for (const doc of snapshot.docs) {
					const data = doc.data() as EventResponse;
					byEventId[data.eventId] = { ...data, id: doc.id };
				}
				onChange(byEventId);
			},
			(error) =>
				console.error("Error subscribing to my response docs", error),
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
