import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { Button, ButtonVariant } from "../ui/Button";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius } from "../../constants/tokens";

interface WorkerAction {
	label: string;
	status: string;
	variant: ButtonVariant;
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
				workers.map((user) => (
					<View
						key={user.id}
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
								<Button
									key={action.status}
									variant={action.variant}
									size="small"
									title={action.label}
									style={styles.actionBtn}
									onPress={() =>
										onStatusChange(user.id, action.status)
									}
								/>
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
		gap: Spacing.sm,
	},
	actionBtn: {
		minWidth: 90,
	},
	emptyText: {
		fontStyle: "italic",
		paddingVertical: Spacing.md,
	},
});
