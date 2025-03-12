import { MarkedDates } from "react-native-calendars/src/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import moment from "moment";

/* An AgendaItem controller that conatains:
  - An AgendaItemData interface that provides the structure of AgendaItem data
  - A function that uses a single event entry and transforms its data into AgendaItemData
  - A function that uses data from all events in Firestore and creates an AgendaItem for each event
  - A function that takes uses a list of AgendaItems and uses their dates to return a list of marked dates
  - A stylesheet object that contains the style data for each part of the AgendaItem component
*/

export interface AgendaItemData {
	day: string;
	title: string;
	startTime: string;
	endTime: string;
	duration: string;
	assigned: string[];
	uid: string;
	attachments?: {
		filename: string;
		url: string;
		type: string;
		path: string;
	}[];
}

export interface AgendaItem {
	[day: string]: AgendaItemData[];
}

function createAgendaItem(
	docRef: FirebaseFirestoreTypes.DocumentData,
): AgendaItemData {
	const id = docRef.id;
	docRef = docRef.data();
	return {
		day: docRef.date,
		title: docRef.title,
		startTime: docRef.startTime,
		endTime: docRef.endTime,
		duration: docRef.duration,
		assigned: docRef.assignedWorkers || [],
		uid: id,
		attachments: docRef.attachments || [],
	};
}

export function getAgendaItems(events: any[]): AgendaItem {
	const res: AgendaItem = {};
	events.forEach((event) => {
		const data = event.data();
		const day = data.date; // Assuming event has a date field in YYYY-MM-DD format
		const item = createAgendaItem(event);

		if (!res[day]) {
			res[day] = [];
		}

		res[day].push(item);
	});

	// Now fill in empty arrays for dates without data
	// Create a range of dates (e.g., 3 months before and after current month)
	const startDate = moment().subtract(50, "months").startOf("month");
	const endDate = moment().add(50, "months").endOf("month");

	// Loop through each day in the range
	for (
		let m = moment(startDate);
		m.diff(endDate, "days") <= 0;
		m.add(1, "days")
	) {
		const dateStr = m.format("YYYY-MM-DD");

		// If this date doesn't already have events, add an empty array
		if (!res[dateStr]) {
			res[dateStr] = [];
		}
	}

	return res;
}

function isEmpty(obj: any): boolean {
	return Object.keys(obj).length === 0;
}

export function getMarkedDates(items: AgendaItem): MarkedDates {
	const marked: MarkedDates = {};
	for (const day in items) {
		if (items[day] && items[day].length > 0) {
			marked[day] = { marked: true };
		}
	}
	return marked;
}
