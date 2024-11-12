import { MarkedDates } from "react-native-calendars/src/types";
import isEmpty from "lodash/isEmpty";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import { useState } from "react";
import AgendaItem, { ItemProps } from "./AgendaItem";
import UserController from "../../controller/userController";
import EventController from "../../controller/eventController";

export const today = new Date().toISOString().split("T")[0];

const [events, setEvents] = useState<FirebaseFirestoreTypes.DocumentData[]>([]);

// useEffect(() => {
//   const fetchEvents = async () => {
//       const fetchedEvents = await EventController.getEventsByDate("2024-11-25");
//       setEvents(fetchedEvents);
//       fetchedEvents.forEach(event => {
//         Alert.alert(event.id);
//       });
//   };

//   fetchEvents();
// }, []); 

// List of items from DB



export async function getAgendaItems(date:string){ //in form of YYYY-MM-DD
  var agendaItemData:ItemProps[] = [];
  const events = await EventController.getEventsByDate(date);
  events.forEach(event => {
    
  const agendaItem: ItemProps = {
    item: {
      title: event.title,
      date: event.date,
      hour: event.hour,
      duration: event.duration,
      company: event.company,
      jsonData: event.jsonData
    }
  };
    agendaItemData.push(agendaItem)
  })

  return agendaItemData
 };


export const agendaItems = [
  {

    
    // 2024-09-27
    title: "2024-09-25",
    data: [{ hour: "12am", title: "First Yoga" }],
  },
];

export function getMarkedDates() {
  const marked: MarkedDates = {};

  agendaItems.forEach((item) => {
    // NOTE: only mark dates with data
    if (item.data && item.data.length > 0 && !isEmpty(item.data[0])) {
      marked[item.title] = { marked: true };
    } else {
      marked[item.title] = { disabled: true };
    }
  });
  return marked;
}

