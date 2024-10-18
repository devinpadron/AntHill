import isEmpty from "lodash/isEmpty";
import { useCallback, memo } from "react";
import {
  StyleSheet,
  Alert,
  View,
  Text,
  TouchableOpacity,
  Button,
} from "react-native";

export interface ItemProps {
  item: {
    title: string;
    date: string;
    hour: string;
    duration: string;
    company: string;
    jsonData: string;
  };
}

const AgendaItem = (props: ItemProps) => {
  const { item } = props;

  const buttonPressed = useCallback(() => {
    Alert.alert("More Info!", item.jsonData);
  }, [item.jsonData]);

  const itemPressed = useCallback(() => {
    Alert.alert(item.title);
  }, [item.title]);

  if (!item || isEmpty(item.title)) {
    return (
      <View style={styles.emptyItem}>
        <Text style={styles.emptyItemText}>No Events Planned</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={itemPressed} style={styles.item}>
      <View>
        <Text style={styles.itemHourText}>{item.hour}</Text>
        <Text style={styles.itemDurationText}>{item.duration}</Text>
      </View>
      <Text style={styles.itemTitleText}>{item.title}</Text>
      <View style={styles.itemButtonContainer}>
        <Button color={"grey"} title={"Info"} onPress={buttonPressed} />
      </View>
    </TouchableOpacity>
  );
};

export default memo(AgendaItem);

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
  emptyItem: {
    paddingLeft: 20,
    height: 52,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "lightgrey",
  },
  emptyItemText: {
    color: "lightgrey",
    fontSize: 14,
  },
});
