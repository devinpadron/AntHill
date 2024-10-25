import { MarkedDates } from "react-native-calendars/src/types";
import isEmpty from "lodash/isEmpty";

export const today = new Date().toISOString().split("T")[0];

// List of items from DB
export const agendaItems = [
  {
    // 2024-09-27
    date: "2024-09-25",
    data: [{ hour: "12:15pm", title: "First Yoga" }],
  },
];

export function getMarkedDates() {
  const marked: MarkedDates = {};

  agendaItems.forEach((item) => {
    // NOTE: only mark dates with data
    if (item.data && item.data.length > 0 && !isEmpty(item.data[0])) {
      marked[item.date] = { marked: true };
    } else {
      marked[item.date] = { disabled: true };
    }
  });
  return marked;
}
