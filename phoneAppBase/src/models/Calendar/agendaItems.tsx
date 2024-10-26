import React, { useCallback, memo } from "react";
import {
  StyleSheet,
  Alert,
  View,
  Text,
  TouchableOpacity,
  Button,
} from "react-native";
import EventController from "../../controller/eventController";
import { MarkedDates } from "react-native-calendars/src/types";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";

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

export async function getAgendaItems(): Promise<AgendaItemData[]> {
  const res: AgendaItemData[] = [];
  const events = await EventController.getAllEvents();

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
    // Check if item.data exists and has elements
    if (item.data && item.data.length > 0 && !isEmpty(item.data[0])) {
      marked[item.date] = { marked: true };
    } else {
      marked[item.date] = { disabled: true };
    }
  });
  return marked;
}

export interface AgendaItemProps {
  item: AgendaItemData;
}
const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  timeContainer: {
    width: 100,
    marginRight: 16,
  },
  timeRow: {
    flexDirection: "row",
  },
  timeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  timeSeparator: {
    color: "#666",
  },
  duration: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    textAlign: "center",
  },
  buttonContainer: {
    marginLeft: 16,
  },
  infoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  infoButtonText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
});
