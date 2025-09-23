import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";

const EventActionButtons = ({ onConfirm, onDecline, eventStatus }) => {
	if (eventStatus !== "available") {
		return null; // Don't show buttons for events that aren't available
	}

	return (
		<View style={styles.container}>
			<TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
				<Text style={styles.buttonText}>CONFIRM</Text>
			</TouchableOpacity>
			<TouchableOpacity style={styles.declineButton} onPress={onDecline}>
				<Text style={styles.buttonText}>DECLINE</Text>
			</TouchableOpacity>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		marginTop: 12,
		justifyContent: "space-between",
	},
	confirmButton: {
		backgroundColor: "#4ADE80",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 4,
		borderWidth: 1,
		borderColor: "#000000",
	},
	declineButton: {
		backgroundColor: "#EF4444",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 4,
		borderWidth: 1,
		borderColor: "#000000",
	},
	buttonText: {
		color: "#FFFFFF",
		fontWeight: "bold",
	},
});

export default EventActionButtons;
