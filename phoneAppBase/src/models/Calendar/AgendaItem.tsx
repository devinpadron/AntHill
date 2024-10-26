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

interface ItemProps {
  item: any;
}

const AgendaItem = (props: ItemProps) => {
  const { item } = props;

  const buttonPressed = useCallback(() => {
    Alert.alert("More Info!");
  }, []);

  const itemPressed = useCallback(() => {
    Alert.alert(item.title);
  }, []);

  if (isEmpty(item)) {
    return (
      <View style={styles.emptyItem}>
        <Text style={styles.emptyItemText}>No Events Planned Today</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity onPress={itemPressed} style={styles.item}>
      <View style={styles.timeContainer}>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>
            {item.startTime || "No start time set"}
            {item.endTime !== "" && (
              <Text>
                <Text style={styles.timeSeparator}> - </Text>
                {item.endTime}
              </Text>
            )}
          </Text>
        </View>
        {item.duration && (
          <Text style={styles.duration}>{item.duration} hours</Text>
        )}
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={buttonPressed} style={styles.infoButton}>
          <Text style={styles.infoButtonText}>Info</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default memo(AgendaItem);

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

  emptyItem: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyItemText: {
    fontSize: 16,
    color: "#888",
  },
});
