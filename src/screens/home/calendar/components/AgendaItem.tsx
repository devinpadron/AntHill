import isEmpty from "lodash/isEmpty";
import { useCallback, memo } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { AntHill } from "../../../../global/colors";
import moment from "moment";

/* An AgendaItem component that is part of the AgendaList that displays information such as:
  - event title
  - event start and end time
  - event duration
*/

export type RootStackParamList = {
	Details: {
		uid: string;
	};
};

interface ItemProps {
	item: any;
}

const AgendaItem = (props: ItemProps) => {
	const { item } = props;

	const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

	// const buttonPressed = useCallback(() => {
	// 	Alert.alert("More Info!");
	// }, []);

	const itemPressed = useCallback(() => {
		//console.log(item);
		navigation.navigate("Details", { uid: item.eventUID });
	}, [item, navigation]);

	if (isEmpty(item)) {
		return (
			<View style={styles.emptyItem}>
				<Text style={styles.emptyItemText}>
					No Events Planned Today
				</Text>
			</View>
		);
	}
	return (
		<TouchableOpacity onPress={itemPressed} style={styles.item}>
			<View style={styles.timeContainer}>
				<View style={styles.timeRow}>
					<Text style={styles.timeText}>
						{moment(item.startTime, "HH:mm").format("h:mma")}
						{item.endTime && (
							<Text>
								<Text style={styles.timeSeparator}> - </Text>
								{moment(item.endTime, "HH:mm").format("h:mma")}
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
			{/* The Info Button, currently not being used. */}
			{/* <View style={styles.buttonContainer}>
				<TouchableOpacity
					onPress={buttonPressed}
					style={styles.infoButton}
				>
					<Text style={styles.infoButtonText}>Info</Text>
				</TouchableOpacity>
			</View> */}
			<View style={{ paddingHorizontal: 0 }}></View>
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
		maxWidth: 150,
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
		color: AntHill.Black,
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
