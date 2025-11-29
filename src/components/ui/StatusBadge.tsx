import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

type StatusVariant =
	| "pending"
	| "confirmed"
	| "declined"
	| "active"
	| "paused"
	| "completed"
	| "approved"
	| "rejected"
	| "pending_approval"
	| "edited";

interface StatusBadgeProps {
	status: StatusVariant | string;
	showIcon?: boolean;
	style?: ViewStyle;
	textStyle?: TextStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
	status,
	showIcon = false,
	style,
	textStyle,
}) => {
	const { theme } = useTheme();

	const getStatusConfig = () => {
		switch (status) {
			case "pending":
			case "pending_approval":
				return {
					color: "#FFB347",
					text:
						status === "pending"
							? "Action Required"
							: "Pending Approval",
					icon: "alert-circle" as const,
				};
			case "confirmed":
			case "approved":
				return {
					color: theme.NotificationGreen,
					text: status === "confirmed" ? "Confirmed" : "Approved",
					icon: "checkmark-circle" as const,
				};
			case "declined":
			case "rejected":
				return {
					color: "#FF6961",
					text: status === "declined" ? "Declined" : "Rejected",
					icon: "close-circle" as const,
				};
			case "active":
				return {
					color: theme.LocationBlue,
					text: "Active",
					icon: "radio-button-on" as const,
				};
			case "paused":
				return {
					color: "#FFEB3B",
					text: "Paused",
					icon: "pause-circle" as const,
				};
			case "completed":
				return {
					color: "#FFA500",
					text: "Completed",
					icon: "checkmark-done" as const,
				};
			case "edited":
				return {
					color: "#9C27B0",
					text: "Edited",
					icon: "create" as const,
				};
			default:
				return {
					color: theme.DateBadge,
					text: status
						.replace(/_/g, " ")
						.replace(/\b\w/g, (c) => c.toUpperCase()),
					icon: "help-circle" as const,
				};
		}
	};

	const config = getStatusConfig();

	return (
		<View style={[styles.badge, { backgroundColor: config.color }, style]}>
			{showIcon && (
				<Ionicons
					name={config.icon}
					size={14}
					color="#FFFFFF"
					style={styles.icon}
				/>
			)}
			<Text style={[styles.text, textStyle]}>{config.text}</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	badge: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 12,
		alignSelf: "flex-start",
	},
	icon: {
		marginRight: 4,
	},
	text: {
		fontSize: 12,
		color: "#FFFFFF",
		fontWeight: "600",
	},
});
