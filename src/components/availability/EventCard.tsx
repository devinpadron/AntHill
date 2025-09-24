import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { formatTime } from "../../utils/dateUtils";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const EventCard = ({ event, onPress }) => {
	const getStatusColor = (status) => {
		switch (status) {
			case "pending":
				return "#FFB347"; // Orange
			case "confirmed":
				return "#77DD77"; // Green
			case "declined":
				return "#FF6961"; // Red
			default:
				return "#DADADA"; // Gray
		}
	};

	const getStatusText = (status) => {
		switch (status) {
			case "pending":
				return "Action Required";
			case "confirmed":
				return "Confirmed";
			case "declined":
				return "Declined";
			default:
				return "Unknown";
		}
	};

	const getStatusIcon = (status) => {
		switch (status) {
			case "pending":
				return "alert-circle-outline";
			case "confirmed":
				return "check-circle-outline";
			case "declined":
				return "close-circle-outline";
			default:
				return "help-circle-outline";
		}
	};

	return (
		<TouchableOpacity
			style={styles.card}
			onPress={onPress}
			activeOpacity={0.7}
		>
			<View style={styles.timeContainer}>
				<Text style={styles.time}>{formatTime(event.startTime)}</Text>
				<Text style={styles.duration}>
					{formatTime(event.startTime)} - {formatTime(event.endTime)}
				</Text>
			</View>

			<View style={styles.contentContainer}>
				<Text style={styles.title}>{event.title}</Text>
				<Text style={styles.location}>{event.location}</Text>
				<Text style={styles.description} numberOfLines={2}>
					{event.description}
				</Text>
			</View>

			<View
				style={[
					styles.statusContainer,
					{ backgroundColor: getStatusColor(event.status) },
				]}
			>
				<Icon
					name={getStatusIcon(event.status)}
					size={16}
					color="#FFFFFF"
				/>
				<Text style={styles.statusText}>
					{getStatusText(event.status)}
				</Text>
			</View>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 8,
		marginHorizontal: 16,
		marginVertical: 8,
		padding: 16,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 1,
		flexDirection: "row",
	},
	timeContainer: {
		width: 80,
		alignItems: "center",
		marginRight: 12,
	},
	time: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#333333",
	},
	duration: {
		fontSize: 12,
		color: "#888888",
		marginTop: 4,
	},
	contentContainer: {
		flex: 1,
	},
	title: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#333333",
		marginBottom: 4,
	},
	location: {
		fontSize: 14,
		color: "#666666",
		marginBottom: 4,
	},
	description: {
		fontSize: 13,
		color: "#888888",
		lineHeight: 18,
	},
	statusContainer: {
		position: "absolute",
		top: 8,
		right: 8,
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 12,
	},
	statusText: {
		fontSize: 12,
		color: "#FFFFFF",
		fontWeight: "500",
		marginLeft: 4,
	},
});

export default EventCard;
