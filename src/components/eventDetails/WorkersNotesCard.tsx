import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, IconSize } from "../../constants/tokens";

interface WorkersNotesCardProps {
	assignedWorkers?: string[];
	workerList: string;
	notes?: string;
}

/**
 * WorkersNotesCard - Displays assigned workers and event notes
 */
export const WorkersNotesCard: React.FC<WorkersNotesCardProps> = ({
	assignedWorkers,
	workerList,
	notes,
}) => {
	const { theme } = useTheme();

	const hasWorkers = assignedWorkers && assignedWorkers.length > 0;
	const hasNotes = !!notes;

	if (!hasWorkers && !hasNotes) return null;

	return (
		<Card padding="md" elevation="md" style={styles.card}>
			{hasWorkers && (
				<View style={styles.section}>
					<View style={styles.sectionHeaderContainer}>
						<Ionicons
							name="people-outline"
							size={IconSize.sm}
							color={theme.LocationBlue}
							style={styles.icon}
						/>
						<Text variant="body" weight="semibold" color="primary">
							Assigned Workers
						</Text>
					</View>
					<Text variant="body" color="primary">
						{workerList}
					</Text>
				</View>
			)}

			{hasNotes && (
				<View
					style={[
						styles.section,
						hasWorkers && [
							styles.sectionDivider,
							{ borderTopColor: theme.BorderColor },
						],
					]}
				>
					<View style={styles.sectionHeaderContainer}>
						<Ionicons
							name="document-text-outline"
							size={IconSize.sm}
							color={theme.LocationBlue}
							style={styles.icon}
						/>
						<Text variant="body" weight="semibold" color="primary">
							Event Notes
						</Text>
					</View>
					<Text variant="body" color="primary">
						{notes}
					</Text>
				</View>
			)}
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		marginBottom: Spacing.lg,
	},
	section: {
		marginBottom: Spacing.sm,
	},
	sectionDivider: {
		paddingTop: Spacing.lg,
		borderTopWidth: 1,
		marginTop: Spacing.lg,
	},
	sectionHeaderContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	icon: {
		marginRight: Spacing.sm,
	},
});
