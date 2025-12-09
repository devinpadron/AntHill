import React from "react";
import { View, StyleSheet } from "react-native";
import { formatTime } from "../../utils/dateUtils";
import { DetailCard } from "../ui/DetailCard";
import { Text } from "../ui/Text";
import { StatusBadge } from "../ui/StatusBadge";
import { useTheme } from "../../contexts/ThemeContext";

export const EventCard = ({ event, onPress }) => {
	const { theme } = useTheme();

	return (
		<DetailCard
			onPress={onPress}
			elevation="sm"
			padding="md"
			style={styles.card}
		>
			<View style={styles.timeContainer}>
				<Text variant="h3" weight="bold" color="primary">
					{formatTime(event.startTime)}
				</Text>
				<Text variant="small" color="secondary" style={styles.duration}>
					{formatTime(event.startTime)} - {formatTime(event.endTime)}
				</Text>
			</View>

			<View style={styles.contentContainer}>
				<Text
					variant="body"
					weight="bold"
					color="primary"
					style={styles.title}
				>
					{event.title}
				</Text>
				<Text variant="body" color="secondary" style={styles.location}>
					{event.location}
				</Text>
				<Text
					variant="caption"
					color="tertiary"
					numberOfLines={2}
					style={styles.description}
				>
					{event.description}
				</Text>
			</View>

			<StatusBadge
				status={event.status}
				showIcon
				style={styles.statusBadge}
			/>
		</DetailCard>
	);
};

const styles = StyleSheet.create({
	card: {
		marginHorizontal: 16,
		marginVertical: 8,
		flexDirection: "row",
	},
	timeContainer: {
		width: 80,
		alignItems: "center",
		marginRight: 12,
	},
	duration: {
		marginTop: 4,
	},
	contentContainer: {
		flex: 1,
	},
	title: {
		marginBottom: 4,
	},
	location: {
		marginBottom: 4,
	},
	description: {
		lineHeight: 18,
	},
	statusBadge: {
		position: "absolute",
		top: 8,
		right: 8,
	},
});
