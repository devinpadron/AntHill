import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../../firebaseConfig";

/*
  STILL NEED TO DO:
  - Integrate user, user privilege, and company logic into events.
  - Add jsonData logic for event-specific details
  - For non admins, hide past events from agenda items
*/

/* An EventController that contains:
  - An event interface that provides the structure of event data
  - A function that uses an eventID to pull from Firestore and retrieve the event entry
  - A function that uses a eventID to update exisiting event data
  - A function that uses a eventID to delete an event from Firestore
  - A function that creates a new event entry and adds it into Firestore
  - A function that uses a date string to retrieve all events for a given date
  - A function that retrieves all of the events stored in Firestore.
*/

interface Event {
	title: string;
	date: string;
	startTime: string;
	endTime: string;
	duration: string;
	//jsonData:string
}

const isValidDateFormat = (date: string): boolean => {
	const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
	if (!dateFormatRegex.test(date)) return false;
	const parsedDate = new Date(date);
	return !isNaN(parsedDate.getTime());
};

export default class EventController {
	private company = "";

	constructor(company: string) {
		this.company = company;
	}

	public getEvent = async (eventID: string) => {
		try {
			//Retrieve event data
			const eventEntry = await db
				.collection("Companies")
				.doc(this.company)
				.collection("Events")
				.doc(eventID)
				.get();
			if (eventEntry.exists) {
				const dbData = eventEntry.data();
				if (dbData) {
					return dbData;
				} else {
					return null;
				}
			} else {
			}
		} catch (e) {
			console.error("Error getting event", e);
		}
	};

	public getEventsByDate = async (
		date: string
	): Promise<FirebaseFirestoreTypes.DocumentData[]> => {
		if (!isValidDateFormat(date)) {
			throw new Error("Invalid date format. Please use YYYY-MM-DD.");
		}
		try {
			const res: FirebaseFirestoreTypes.DocumentData[] = [];
			const eventsFromDB = await db
				.collection("Companies")
				.doc(this.company)
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
	};

	public getAllEvents = async (): Promise<
		FirebaseFirestoreTypes.DocumentData[]
	> => {
		try {
			const res: FirebaseFirestoreTypes.DocumentData[] = [];
			const eventsFromDB = await db
				.collection("Companies")
				.doc(this.company)
				.collection("Events")
				.get();
			eventsFromDB.forEach((event) => {
				const eventData = event.data() as Event;
				res.push(eventData);
			});

			return res;
		} catch (e) {
			console.error("Failed to get events", e);
			throw e;
		}
	};

	public addEvent = async (newEvent: Event) => {
		try {
			const entry = await db
				.collection("Companies")
				.doc(this.company)
				.collection("Events")
				.add(newEvent);
			const entryid = entry.id;
			return entryid;
		} catch (e) {
			console.error("Error adding event:", e);
			throw e;
		}
	};

	public deleteEvent = async (eventID: string) => {
		// Delete an existing event
		try {
			await db
				.collection("Companies")
				.doc(this.company)
				.collection("Events")
				.doc(eventID)
				.delete();
			console.log("Event successfully deleted");
			return true;
		} catch (e) {
			console.error("Error deleting event:", e);
			throw e;
		}
	};

	public updateEvent = async (eventID: string, eventData: Event) => {
		try {
			await db
				.collection("Companies")
				.doc(this.company)
				.collection("Events")
				.doc(eventID)
				.update(eventData);
			console.log("Event successfully updated");
			return true;
		} catch (e) {
			console.error("Error updating event:", e);
			throw e;
		}
	};
}
