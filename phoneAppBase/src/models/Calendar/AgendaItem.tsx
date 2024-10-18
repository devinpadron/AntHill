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

export interface AgendaItemData {
  title: string;
  date: string;
  hour: string;
  duration: string;
  company: string;
}

export interface AgendaItemProps {
  item: AgendaItemData;
}

export const AgendaItem: React.FC<AgendaItemProps> = memo(({ item }) => {
  const buttonPressed = useCallback(() => {
    Alert.alert("More Info!", `Company: ${item.company}`);
  }, [item.company]);

  const itemPressed = useCallback(() => {
    Alert.alert(item.title || "No title available");
  }, [item.title]);

  return (
    <TouchableOpacity onPress={itemPressed} style={styles.item}>
      <View>
        <Text style={styles.itemHourText}>{item.hour || "No time set"}</Text>
        <Text style={styles.itemDurationText}>{item.duration || "Duration not specified"}</Text>
      </View>
      <Text style={styles.itemTitleText}>{item.title}</Text>
      <View style={styles.itemButtonContainer}>
        <Button color={"grey"} title={"Info"} onPress={buttonPressed} />
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  item: {
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "lightgrey",
    flexDirection: "row",
  },
  itemHourText: {
    color: "black",
  },
  itemDurationText: {
    color: "grey",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  itemTitleText: {
    color: "black",
    marginLeft: 16,
    fontWeight: "bold",
    fontSize: 16,
  },
  itemButtonContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
});

export default AgendaItem;

export async function getAgendaItems(date: string): Promise<AgendaItemData[]> {
  const res:AgendaItemData[] = [];
  const events = await EventController.getEventsByDate(date);
  
  events.forEach(event =>{
    res.push({
      title: event.title,
      date: event.date,
      hour: event.hour,
      duration: event.duration,
      company: event.company,
    });
  });

  return res
};