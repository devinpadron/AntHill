import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius } from "../../constants/tokens";

interface WorkerAction {
	label: string;
	status: string;
	color: string;
	icon: keyof typeof Ionicons.glyphMap;
}

interface Worker {
	id: string;
	firstName: string;
	lastName: string;
}

interface WorkerSectionProps {
	title: string;
	icon: keyof typeof Ionicons.glyphMap;
	iconColor: string;
	workers: Worker[];
	actions: WorkerAction[];
	onStatusChange: (userId: string, status: string) => void;
	emptyText: string;
}

export const WorkerSection: React.FC<WorkerSectionProps> = ({
	title,
	icon,
	iconColor,
	workers,
	actions,
	onStatusChange,
	emptyText,
}) => {
	const { theme } = useTheme();

	return (
		<View style={[styles.section, { borderBottomColor: theme.DateBadge }]}>
			<View style={styles.headerRow}>
				<Ionicons name={icon} size={20} color={iconColor} />
				<Text
					variant="body"
					weight="semibold"
					color="primary"
					style={styles.title}
				>
					{title} ({workers.length})
				</Text>
			</View>

			{workers.length > 0 ? (
				workers.map((user, index) => (
					<View
						key={index}
						style={[
							styles.workerItem,
							{ backgroundColor: theme.DateBadge },
						]}
					>
						<Text
							variant="caption"
							weight="medium"
							color="primary"
							style={styles.workerName}
						>
							{user.firstName} {user.lastName}
						</Text>
						<View style={styles.workerActions}>
							{actions.map((action) => (
								<TouchableOpacity
									key={action.status}
									style={[
										styles.actionBtn,
										{ backgroundColor: action.color },
									]}
									onPress={() =>
										onStatusChange(user.id, action.status)
									}
								>
									<Ionicons
										name={action.icon}
										size={14}
										color="#fff"
									/>
									<Text
										variant="small"
										color="white"
										weight="semibold"
										style={styles.actionBtnText}
									>
										{action.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
				))
			) : (
				<Text
					variant="caption"
					color="tertiary"
					align="center"
					style={styles.emptyText}
				>
					{emptyText}
				</Text>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	section: {
		paddingHorizontal: Spacing.xl,
		paddingVertical: Spacing.lg,
		borderBottomWidth: 1,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	title: {
		marginLeft: Spacing.sm,
	},
	workerItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: Spacing.sm,
		paddingHorizontal: Spacing.md,
		borderRadius: BorderRadius.md,
		marginBottom: Spacing.sm,
	},
	workerName: {
		flex: 1,
	},
	workerActions: {
		flexDirection: "row",
		gap: 8,
	},
	actionBtn: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: BorderRadius.sm + 2,
	},
	actionBtnText: {
		marginLeft: 4,
	},
	emptyText: {
		fontStyle: "italic",
		paddingVertical: Spacing.md,
	},
});
