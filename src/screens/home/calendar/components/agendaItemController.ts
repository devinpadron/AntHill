import { MarkedDates } from "react-native-calendars/src/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { getAllEvents } from "../../../../controllers/data/eventController";

/* An AgendaItem controller that conatains:
  - An AgendaItemData interface that provides the structure of AgendaItem data
  - A function that uses a single event entry and transforms its data into AgendaItemData
  - A function that uses data from all events in Firestore and creates an AgendaItem for each event
  - A function that takes uses a list of AgendaItems and uses their dates to return a list of marked dates
  - A stylesheet object that contains the style data for each part of the AgendaItem component
*/

export interface AgendaItemData {
	date: string;
	data: [
		{ title: string; startTime: string; endTime: string; duration: string }
	];
}

function createAgendaItem(
	docRef: FirebaseFirestoreTypes.DocumentData
): AgendaItemData {
	return {
		date: docRef.date,
		data: [
			{
				title: docRef.title,
				startTime: docRef.startTime,
				endTime: docRef.endTime,
				duration: docRef.duration,
			},
		],
	};
}

export async function getAgendaItems(
	company: string
): Promise<AgendaItemData[]> {
	const res: AgendaItemData[] = [];
	const events = await getAllEvents(company);

	events.forEach((event) => {
		res.push(createAgendaItem(event));
	});

	return res;
}

function isEmpty(obj: any): boolean {
	return Object.keys(obj).length === 0;
}

export function getMarkedDates(items: AgendaItemData[]): MarkedDates {
	const marked: MarkedDates = {};
	items.forEach((item) => {
		if (item.data && item.data.length > 0 && !isEmpty(item.data[0])) {
			marked[item.date] = { marked: true };
		} else {
			marked[item.date] = { disabled: true };
		}
	});
	return marked;
}
