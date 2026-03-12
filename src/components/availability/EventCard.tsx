import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DetailCard } from "../ui/DetailCard";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { StatusBadge } from "../ui/StatusBadge";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing } from "../../constants/tokens";
import type { AvailabilityTab } from "./AvailabilityTabBar";

interface AvailabilityEvent {
	id: string;
	title: string;
	date: string;
	location: string;
	status?: string;
}

interface EventCardProps {
	event: AvailabilityEvent;
	activeTab: AvailabilityTab;
	onConfirm: () => void;
	onDecline: () => void;
	onUndecline: () => void;
	onPress?: () => void;
}

const getStatusVariant = (
	activeTab: AvailabilityTab,
	eventStatus?: string,
): string => {
	if (activeTab === "confirmed") return "confirmed";
	if (activeTab === "declined") return "declined";
	switch (eventStatus) {
		case "available":
			return "confirmed";
		case "already_on_event":
			return "declined";
		default:
			return "pending";
	}
};

const getStatusLabel = (
	activeTab: AvailabilityTab,
	eventStatus?: string,
): string => {
	if (activeTab === "confirmed") return "Confirmed";
	if (activeTab === "declined") return "Declined";
	switch (eventStatus) {
		case "available":
			return "Available";
		case "already_on_event":
			return "Already on Event";
		default:
			return "";
	}
};

const getBorderColor = (
	activeTab: AvailabilityTab,
	theme: any,
	eventStatus?: string,
): string | undefined => {
	if (activeTab !== "unconfirmed") return undefined;
	switch (eventStatus) {
		case "available":
			return theme.NotificationGreen;
		case "already_on_event":
			return theme.SecondaryText;
		default:
			return theme.TertiaryText;
	}
};

export const EventCard: React.FC<EventCardProps> = ({
	event,
	activeTab,
	onConfirm,
	onDecline,
	onUndecline,
	onPress,
}) => {
	const { theme } = useTheme();
	const borderColor = getBorderColor(activeTab, theme, event.status);
	const statusLabel = getStatusLabel(activeTab, event.status);

	const cardStyle = borderColor
		? {
				marginBottom: Spacing.md,
				borderLeftColor: borderColor,
				borderLeftWidth: 3,
			}
		: {
				marginBottom: Spacing.md,
			};

	const showActions =
		activeTab === "unconfirmed" &&
		(event.status === "available" || event.status === "already_on_event");
	const showUndecline = activeTab === "declined";

	return (
		<DetailCard
			onPress={onPress}
			elevation="sm"
			padding="md"
			style={cardStyle}
		>
			<View style={styles.header}>
				<View style={styles.info}>
					<Text
						variant="h3"
						weight="bold"
						color="primary"
						style={styles.title}
					>
						{event.title}
					</Text>
					<Text
						variant="body"
						weight="bold"
						color="primary"
						style={styles.date}
					>
						{event.date}
					</Text>
					<View style={styles.locationRow}>
						<Ionicons
							name="location"
							size={14}
							color={theme.SecondaryText}
						/>
						<Text
							variant="caption"
							color="secondary"
							style={styles.location}
						>
							{event.location}
						</Text>
					</View>
				</View>

				{statusLabel !== "" && (
					<StatusBadge
						status={getStatusVariant(activeTab, event.status)}
						showIcon
					/>
				)}
			</View>

			{/* Action Buttons for Unconfirmed tab */}
			{showActions && (
				<View style={styles.buttonRow}>
					<Button
						variant="destructive"
						size="small"
						title="Decline"
						onPress={onDecline}
						icon={
							<Ionicons
								name="close-circle"
								size={16}
								color={theme.CardBackground}
							/>
						}
						style={styles.button}
					/>
					<Button
						variant="primary"
						size="small"
						title="Confirm"
						onPress={onConfirm}
						icon={
							<Ionicons
								name="checkmark-circle"
								size={16}
								color={theme.CardBackground}
							/>
						}
						style={[styles.button, styles.confirmButton]}
					/>
				</View>
			)}

			{/* Undecline Button for Declined tab */}
			{showUndecline && (
				<View style={styles.buttonRow}>
					<Button
						variant="primary"
						size="small"
						title="Undecline"
						onPress={onUndecline}
						icon={
							<Ionicons
								name="refresh"
								size={16}
								color={theme.CardBackground}
							/>
						}
						style={styles.undeclineButton}
					/>
				</View>
			)}
		</DetailCard>
	);
};

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
	},
	info: {
		flex: 1,
	},
	title: {
		marginBottom: Spacing.xs,
	},
	date: {
		marginBottom: Spacing.xs,
	},
	locationRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	location: {
		marginLeft: Spacing.xs,
	},
	buttonRow: {
		flexDirection: "row",
		marginTop: Spacing.lg,
		justifyContent: "flex-end",
		gap: Spacing.md,
	},
	button: {
		minWidth: 110,
	},
	confirmButton: {
		minWidth: 120,
	},
	undeclineButton: {
		minWidth: 130,
	},
});
