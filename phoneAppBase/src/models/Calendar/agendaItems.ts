import isEmpty from "lodash/isEmpty";
import { MarkedDates } from "react-native-calendars/src/types";

export const today = new Date().toISOString().split("T")[0];
// const pastDate = getPastDate(3);
// const futureDates = getFutureDates(12);
// const dates = [pastDate, today].concat(futureDates);

// function getFutureDates(numberOfDays: number) {
//   const array: string[] = [];
//   for (let index = 1; index <= numberOfDays; index++) {
//     let d = Date.now();
//     if (index > 8) {
//       // set dates on the next month
//       const newMonth = new Date(d).getMonth() + 1;
//       d = new Date(d).setMonth(newMonth);
//     }
//     const date = new Date(d + 864e5 * index); // 864e5 == 86400000 == 24*60*60*1000
//     const dateString = date.toISOString().split("T")[0];
//     array.push(dateString);
//   }
//   return array;
// }
// function getPastDate(numberOfDays: number) {
//   return new Date(Date.now() - 864e5 * numberOfDays)
//     .toISOString()
//     .split("T")[0];
// }

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
