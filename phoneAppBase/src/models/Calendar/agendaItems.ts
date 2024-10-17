import { MarkedDates } from "react-native-calendars/src/types";
import isEmpty from "lodash/isEmpty";

export const today = new Date().toISOString().split("T")[0];

// List of items from DB
export const agendaItems = [
  {
    // 2024-09-27
    title: "2024-09-25",
    data: [{ hour: "12am", duration: "1h", title: "First Yoga" }],
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
