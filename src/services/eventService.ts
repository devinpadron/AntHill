import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { AttachmentItem, Event } from "../types";
import db from "../constants/firestore";
/* An EventController that contains:
  - An event interface that provides the structure of event data
  - A function that uses an eventID to pull from Firestore and retrieve the event entry
  - A function that uses a eventID to update exisiting event data
  - A function that uses a eventID to delete an event from Firestore
  - A function that creates a new event entry and adds it into Firestore
  - A function that uses a date string to retrieve all events for a given date
  - A function that retrieves all of the events stored in Firestore.
*/

const isValidDateFormat = (date: string): boolean => {
	const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateFormatRegex.test(date)) return false;
	const parsedDate = new Date(date);
	return !isNaN(parsedDate.getTime());
};

export async function getEvent(company: string, eventID: string) {
	try {
		//Retrieve event data
		const eventEntry = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.doc(eventID)
			.get();

		return eventEntry.data() as Event;
	} catch (e) {
		console.error("Error getting event", e);
	}
}

export async function getEventAttachments(
	company: string,
	eventID: string,
): Promise<AttachmentItem[]> {
	const eventEntry = await db
		.collection("Companies")
		.doc(company)
		.collection("Events")
		.doc(eventID)
		.collection("Attachments")
		.get();
	const attachments: AttachmentItem[] = [];
	eventEntry.forEach((attachment) => {
		const attachmentData = attachment.data() as AttachmentItem;
		attachments.push({
			...attachmentData,
			isExisting: true,
		});
	});

	return attachments;
}

export function subscribeEvent(
	company: string,
	eventID: string,
	onSnap: (
		snapshot: FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
	) => void,
) {
	return db
		.collection("Companies")
		.doc(company)
		.collection("Events")
		.doc(eventID)
		.onSnapshot(onSnap);
}

export async function getEventsByDate(
	company: string,
	date: string,
): Promise<FirebaseFirestoreTypes.DocumentData[]> {
	if (!isValidDateFormat(date)) {
		throw new Error("Invalid date format. Please use YYYY-MM-DD.");
	}
	try {
		const res: FirebaseFirestoreTypes.DocumentData[] = [];
		const eventsFromDB = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.where("date", "==", date)
			.get();

		eventsFromDB.forEach((event) => {
			const eventData = event.data() as Event;
			res.push(eventData);
		});

		return res;
	} catch (e) {
		console.error(`Failed to get events for ${date}:`);
		throw e;
	}
}

export async function getAllEvents(
	company: string,
): Promise<FirebaseFirestoreTypes.DocumentData[]> {
	try {
		const eventsFromDB = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.get();
		return eventsFromDB.docs;
	} catch (e) {
		console.error("Failed to get events", e);
		throw e;
	}
}

export function subscribeAllEvents(
	company: string,
	onSnap: (
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
	) => void,
) {
	return db
		.collection("Companies")
		.doc(company)
		.collection("Events")
		.onSnapshot(onSnap);
}

export async function addEvent(company: string, newEvent: Event) {
	try {
		const entry = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.add(newEvent);
		const entryid = entry.id;

		entry.update({
			id: entryid,
		});

		return entryid;
	} catch (e) {
		console.error("Error adding event:", e);
		throw e;
	}
}

export async function deleteEvent(eventID: string, company: string) {
	// Delete an existing event
	try {
		await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.doc(eventID)
			.delete();
		console.log("Event successfully deleted");
		return true;
	} catch (e) {
		console.error("Error deleting event:", e);
		throw e;
	}
}

export async function updateEvent(
	company: string,
	eventID: string,
	eventData: any,
) {
	try {
		await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.doc(eventID)
			.update(eventData);
		return true;
	} catch (e) {
		console.error("Error updating event:", e);
		throw e;
	}
}

export const getEventsByIds = async (companyId: string, eventIds: string[]) => {
	try {
		if (!eventIds || eventIds.length === 0) {
			return [];
		}

		// Due to Firestore limitations, we can't query with 'in' for large arrays
		// So we'll fetch events one by one
		const events = await Promise.all(
			eventIds.map((eventId) =>
				db
					.collection("Companies")
					.doc(companyId)
					.collection("Events")
					.doc(eventId)
					.get()
					.then((doc) => {
						if (doc.exists) {
							return { id: doc.id, ...doc.data() };
						}
						return null;
					}),
			),
		);

		return events.filter((event) => event !== null);
	} catch (error) {
		console.error("Error fetching events by IDs:", error);
		throw error;
	}
};

export const updateEventChecklist = async (
	companyId: string,
	eventId: string,
	checklistId: string,
	checklistItem: { [key: string]: boolean },
) => {
	try {
		const eventRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Events")
			.doc(eventId);

		if (checklistItem) {
			await eventRef
				.collection("Checklists")
				.doc(checklistId)
				.set(checklistItem);
		}
	} catch (error) {
		console.error("Error updating event checklist:", error);
		throw error;
	}
};

export const subscribeEventChecklist = async (
	companyId: string,
	eventId: string,
	onSnap: (
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
	) => void,
) => {
	try {
		const eventRef = db
			.collection("Companies")
			.doc(companyId)
			.collection("Events")
			.doc(eventId)
			.collection("Checklists")
			.onSnapshot(onSnap);
		return eventRef;
	} catch (error) {
		console.error("Error updating event checklist:", error);
		throw error;
	}
};
