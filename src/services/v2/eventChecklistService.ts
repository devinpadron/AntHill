import firestore from "@react-native-firebase/firestore";
import db from "../../lib/db";
import { C } from "../../constants/paths";
import { ChecklistItemState, EventChecklistState } from "../../types/v2";

/*
 * Per-event checklist completion.
 *
 * Kept OFF the event document on purpose: the calendar subscribes to events, so
 * storing tick state there would push a snapshot to every device showing the
 * calendar each time somebody checked a box.
 *
 * Writes are per-item field paths. v1 used `.set()` without merge on a partial
 * map (eventService.ts:234), so one worker ticking an item wiped every item
 * another worker had already ticked.
 */

export function subscribeChecklistState(
	eventId: string,
	onChange: (state: EventChecklistState | null) => void,
): () => void {
	if (!eventId) return () => {};

	return db
		.collection(C.eventChecklistStates)
		.doc(eventId)
		.onSnapshot(
			(doc) =>
				onChange(
					doc.exists()
						? { ...(doc.data() as EventChecklistState), eventId }
						: null,
				),
			(error) =>
				console.error("Error subscribing to checklist state", error),
		);
}

/**
 * Sets one item. A dotted field path, so concurrent workers on the same event
 * never clobber each other.
 */
export async function setItemState(
	companyId: string,
	eventId: string,
	checklistId: string,
	itemId: string,
	state: ChecklistItemState,
): Promise<void> {
	const ref = db.collection(C.eventChecklistStates).doc(eventId);

	try {
		await ref.set(
			{
				eventId,
				companyId,
				state: { [checklistId]: { [itemId]: state } },
				updatedAt: firestore.FieldValue.serverTimestamp(),
				schemaVersion: 2,
			},
			// mergeFields targets only this item, leaving every sibling alone even
			// on the very first write, when the document does not exist yet.
			{
				mergeFields: [
					`state.${checklistId}.${itemId}`,
					"eventId",
					"companyId",
					"updatedAt",
					"schemaVersion",
				],
			},
		);
	} catch (e) {
		console.error("Error setting checklist item state", e);
		throw e;
	}
}

export async function getChecklistState(
	eventId: string,
): Promise<EventChecklistState | null> {
	try {
		const doc = await db
			.collection(C.eventChecklistStates)
			.doc(eventId)
			.get();
		return doc.exists()
			? { ...(doc.data() as EventChecklistState), eventId }
			: null;
	} catch (e) {
		console.error("Error getting checklist state", e);
		return null;
	}
}
