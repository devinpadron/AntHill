import { MarkedDates } from "react-native-calendars/src/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../constants/firestore";

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
	labelId?: string;
}

export interface AgendaItem {
	[day: string]: AgendaItemData[];
}

function createAgendaItem(
	docRef: FirebaseFirestoreTypes.DocumentData,
): AgendaItemData {
	docRef = docRef.data();
	return {
		day: docRef.date,
		title: docRef.title,
		startTime: docRef.startTime,
		endTime: docRef.endTime,
		duration: docRef.duration,
		assigned: docRef.assignedWorkers || [],
		uid: docRef.id,
		attachments: docRef.attachments || [],
		labelId: docRef.labelId || "",
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
	return res;
}

function isEmpty(obj: any): boolean {
	return Object.keys(obj).length === 0;
}

export function getMarkedDates(events: any[], labelMap: any): MarkedDates {
	const marked: MarkedDates = {};
	events.forEach((event) => {
		const data = event.data();
		const day = data.date; // Assuming event has a date field in YYYY-MM-DD format
		const label = labelMap[data.labelId] || "grey"; // Default to blue if no label found
		if (day) {
			marked[day] = { marked: true, dotColor: label };
		}
	});
	return marked;
}
