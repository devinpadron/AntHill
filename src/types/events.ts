import { BaseDoc, CompanyScoped, DateKey, Timestamp } from "./common";

export interface EventLocation {
	latitude: number;
	longitude: number;
	label: string | null;
}

/** events/{eventId} */
export interface Event extends BaseDoc, CompanyScoped {
	title: string;
	/** Local calendar day. Range-queried by the calendar. */
	dateKey: DateKey;
	/** Explicit, replacing v1's `startTime === null` encoding. */
	isAllDay: boolean;
	startAt: Timestamp | null;
	endAt: Timestamp | null;
	/** Was a STRING of hours in v1. */
	durationSeconds: number | null;
	/** Was `notes` — authored by managers. */
	adminNotes: string;
	/** Was `userNotes` — authored by assigned workers. */
	workerNotes: string;
	locations: Record<string, EventLocation>;
	/** Was `assignedWorkers`. */
	assignedUserIds: string[];
	/**
	 * Always present and always correct, which is what makes the "unassigned"
	 * filter work. v1 queried `assignedWorkers == []`, which silently missed
	 * every event where the field was absent rather than an empty array.
	 */
	assignedCount: number;
	packageIds: string[];
	/** Flattened from the packages at write time. */
	checklistIds: string[];
	labelId: string | null;
	attachmentCount: number;
	/**
	 * Groups this event was published to. Empty means open to everyone, which
	 * is how every migrated event and every event created without a group
	 * behaves — i.e. exactly v1.
	 */
	audienceGroupIds: string[];
	/**
	 * Individual workers invited to this event, independent of any group.
	 *
	 * For the one-off case a group cannot express: this specific bartender,
	 * because they worked the venue last month.
	 */
	audienceUserIds: string[];
	/**
	 * True when either audience list is non-empty, denormalized because
	 * Firestore cannot query on array length.
	 *
	 * Always present. The open-availability query filters on
	 * `isTargeted == false`, and an equality filter does not match documents
	 * where the field is missing — absent would mean invisible to everyone.
	 */
	isTargeted: boolean;
	/** Denormalized, best-effort; `verify` re-derives it. */
	responseCounts: {
		confirmed: number;
		declined: number;
		pending: number;
	};
	createdBy: string | null;
	updatedBy: string | null;
}

export type EventResponseStatus = "pending" | "confirmed" | "declined";

/**
 * eventResponses/{eventId}_{userId}
 *
 * One document per (event, worker) rather than v1's `workerStatus` map on the
 * event. Two reasons: the map required read-modify-write, so concurrent
 * confirm/decline lost updates; and security rules can only diff top-level
 * keys, so with a map every worker needed write access to everyone else's
 * response.
 *
 * `status` is ALWAYS explicit — in v1, absence meant pending except when
 * `undeclineEvent` wrote "pending" literally, so the same state had two
 * encodings.
 */
export interface EventResponse extends CompanyScoped {
	id: string;
	eventId: string;
	userId: string;
	/** Denormalized so "my upcoming events" is one indexed query. */
	dateKey: DateKey;
	status: EventResponseStatus;
	respondedAt: Timestamp | null;

	/*
	 * ACKNOWLEDGEMENT — a different question from `status`, on the same
	 * document.
	 *
	 *   status         "can you work this?"   asked BEFORE assignment
	 *   acknowledgedAt "I see I am working this"  asked AFTER assignment
	 *
	 * They are independent on purpose. A worker who never answered the
	 * availability question can still be assigned and acknowledge it, and a
	 * worker who confirmed availability weeks ago still has to see that the
	 * shift became real.
	 *
	 * Null means not acknowledged. The document now exists for every ASSIGNED
	 * worker as well as every invited one — see ensureAssignmentRecords.
	 */
	acknowledgedAt: Timestamp | null;

	updatedAt: Timestamp;
	schemaVersion: number;
}

/** Checklist item state. Tri-state, cycled by tapping. */
export const ITEM_UNCHECKED = 0;
export const ITEM_CHECKED = 1;
export const ITEM_STRIKETHROUGH = 2;

export type ChecklistItemState =
	typeof ITEM_UNCHECKED | typeof ITEM_CHECKED | typeof ITEM_STRIKETHROUGH;

/**
 * eventChecklistStates/{eventId}
 *
 * Deliberately NOT stored on the event document: the calendar subscribes to
 * events, so a checkbox tap would push a snapshot to every device showing the
 * calendar.
 */
export interface EventChecklistState extends CompanyScoped {
	eventId: string;
	state: Record<string, Record<string, ChecklistItemState>>;
	updatedAt: Timestamp;
	schemaVersion: number;
}

/** checklists/{checklistId} */
export interface ChecklistItem {
	id: string;
	text: string;
}

export interface Checklist extends BaseDoc, CompanyScoped {
	title: string;
	/** v1 also had a legacy `string[]` form; normalized by the migration. */
	items: ChecklistItem[];
}

/** packages/{packageId} */
export interface Package extends BaseDoc, CompanyScoped {
	title: string;
	description: string;
	/** Was `checklists: [{checklistId}]`. */
	checklistIds: string[];
}

/** eventLabels/{labelId} */
export interface EventLabel extends BaseDoc, CompanyScoped {
	name: string;
	color: string;
}
