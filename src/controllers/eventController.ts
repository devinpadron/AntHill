import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { FileUpload } from "../screens/home/calendar/EventSubmit";
import db from "../global/firestore";
import { addAttachments, getEventAttachments } from "./attachmentController";
/* An EventController that contains:
  - An event interface that provides the structure of event data
  - A function that uses an eventID to pull from Firestore and retrieve the event entry
  - A function that uses a eventID to update exisiting event data
  - A function that uses a eventID to delete an event from Firestore
  - A function that creates a new event entry and adds it into Firestore
  - A function that uses a date string to retrieve all events for a given date
  - A function that retrieves all of the events stored in Firestore.
*/

type Location = {
	[address: string]: {
		latitude: number;
		longitude: number;
	};
};

export interface Event {
	title: string;
	date: string;
	startTime: string;
	endTime: string | null;
	locations: Location;
	duration: string | null;
	notes: string;
	assignedWorkers: string[];
	attachments?: FileUpload[];
}

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
		if (eventEntry.exists) {
			const dbData = eventEntry.data();
			if (dbData) {
				const attachments = await getEventAttachments(company, eventID);
				return {
					...dbData,
					attachments,
				};
			} else {
				return null;
			}
		}
	} catch (e) {
		console.error("Error getting event", e);
	}
}

export function subscribeEvent(
	company: string,
	eventID: string,
	onSnap: (
		snapshot: FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData>
	) => void
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
	date: string
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
	company: string
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
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
	) => void
) {
	return db
		.collection("Companies")
		.doc(company)
		.collection("Events")
		.onSnapshot(onSnap);
}

export function subscribeEvents(
	type: string,
	company: string,
	userIDs: string[],
	onSnap: (
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
	) => void,
	filterOptions?: {
		requireAllSelected?: boolean;
		exactMatchOnly?: boolean;
	}
) {
	try {
		switch (type) {
			case "all":
				// All events for the company
				return db
					.collection("Companies")
					.doc(company)
					.collection("Events")
					.onSnapshot(onSnap);

			case "my":
				// Only logged-in user's events
				return db
					.collection("Companies")
					.doc(company)
					.collection("Events")
					.where("assignedWorkers", "array-contains", userIDs[0])
					.onSnapshot(onSnap);

			case "specific":
				if (filterOptions?.exactMatchOnly) {
					// Only show events where exactly these users are assigned (no more, no less)
					return db
						.collection("Companies")
						.doc(company)
						.collection("Events")
						.where("assignedWorkers", "==", userIDs.sort())
						.onSnapshot(onSnap);
				} else if (filterOptions?.requireAllSelected) {
					// Show events where all selected users are assigned (others may be too)
					return db
						.collection("Companies")
						.doc(company)
						.collection("Events")
						.where("assignedWorkers", "array-contains", userIDs[0])
						.onSnapshot((snapshot) => {
							// Filter in memory to check if all selected users are present
							const filteredDocs = snapshot.docs.filter((doc) => {
								const assignedWorkers =
									doc.data().assignedWorkers || [];
								return userIDs.every((uid) =>
									assignedWorkers.includes(uid)
								);
							});
							// Create a new snapshot-like object with filtered docs
							const filteredSnapshot = {
								...snapshot,
								docs: filteredDocs,
								size: filteredDocs.length,
							};
							onSnap(filteredSnapshot as any);
						});
				}
				// Default: show events where any of the selected users are assigned
				return db
					.collection("Companies")
					.doc(company)
					.collection("Events")
					.where("assignedWorkers", "array-contains-any", userIDs)
					.onSnapshot(onSnap);

			case "unassigned":
				// Events with empty assignedWorkers array
				return db
					.collection("Companies")
					.doc(company)
					.collection("Events")
					.where("assignedWorkers", "==", [])
					.onSnapshot(onSnap);
		}
	} catch (e) {
		console.error("Error getting events:", e);
		return () => {};
	}
}
export async function addEvent(company: string, newEvent: Event) {
	try {
		const { attachments, ...eventData } = newEvent;

		const entry = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.add(newEvent);
		const entryid = entry.id;

		if (attachments && attachments.length > 0) {
			await addAttachments(company, entry.id, attachments);
		}

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
	eventData: Event
) {
	try {
		await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.doc(eventID)
			.update(eventData);
		//console.log("Event successfully updated");
		return true;
	} catch (e) {
		console.error("Error updating event:", e);
		throw e;
	}
}
