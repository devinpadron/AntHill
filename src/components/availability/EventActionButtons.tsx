import React from "react";
import { View, StyleSheet } from "react-native";
import { Button } from "../ui/Button";
import { useTheme } from "../../contexts/ThemeContext";

const EventActionButtons = ({ onConfirm, onDecline, eventStatus }) => {
	const { theme } = useTheme();

	if (eventStatus !== "available") {
		return null; // Don't show buttons for events that aren't available
	}

	return (
		<View style={styles.container}>
			<Button
				variant="primary"
				size="medium"
				onPress={onConfirm}
				title="CONFIRM"
				style={[
					styles.button,
					{ backgroundColor: theme.NotificationGreen },
				]}
			/>
			<Button
				variant="destructive"
				size="medium"
				onPress={onDecline}
				title="DECLINE"
				style={styles.button}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		marginTop: 12,
		justifyContent: "space-between",
	},
	button: {
		flex: 1,
		marginHorizontal: 4,
	},
});

export default EventActionButtons;
