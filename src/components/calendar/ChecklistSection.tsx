import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { Card } from "../ui/Card";
import { useTheme } from "../../contexts/ThemeContext";
import {
	Spacing,
	BorderRadius,
	IconSize,
	Shadow,
} from "../../constants/tokens";
import { Checklist } from "../../types";
import { UNCHECKED } from "../../hooks/useEventChecklists";
import { ChecklistItem } from "./ChecklistItem";

interface ChecklistSectionProps {
	checklist: Checklist;
	itemStates: Record<string, number>;
	isComplete: boolean;
	progressPercentage: number;
	onToggleItem: (checklistId: string, itemId: string) => void;
}

export const ChecklistSection: React.FC<ChecklistSectionProps> = ({
	checklist,
	itemStates,
	isComplete,
	progressPercentage,
	onToggleItem,
}) => {
	const { theme } = useTheme();

	// Sort items: unchecked first, then checked/strikethrough
	const sortedItems = checklist.items
		? [...checklist.items].sort((a, b) => {
				const stateA = itemStates?.[a.id] || UNCHECKED;
				const stateB = itemStates?.[b.id] || UNCHECKED;

				if (stateA === UNCHECKED && stateB !== UNCHECKED) return -1;
				if (stateB === UNCHECKED && stateA !== UNCHECKED) return 1;
				return 0;
			})
		: [];

	return (
		<View style={styles.checklistSection}>
			{/* Header card with title and progress */}
			<Card padding="md" elevation="sm" style={styles.headerCard}>
				<View style={styles.titleContainer}>
					<Text
						variant="h3"
						color={isComplete ? "success" : "primary"}
						weight="bold"
						style={styles.checklistTitle}
					>
						{checklist.title}
					</Text>
					{isComplete && (
						<Ionicons
							name="checkmark-circle"
							size={IconSize.md}
							color={theme.NotificationGreen}
							style={styles.completedIcon}
						/>
					)}
				</View>

				<View style={styles.progressContainer}>
					<View
						style={[
							styles.progressBar,
							{ backgroundColor: theme.DateBadge },
						]}
					>
						<View
							style={[
								styles.progressFill,
								{
									width: `${progressPercentage}%`,
									backgroundColor: theme.NotificationGreen,
								},
							]}
						/>
					</View>
					<Text
						variant="caption"
						color="secondary"
						style={styles.progressText}
					>
						{progressPercentage}%
					</Text>
				</View>
			</Card>

			{/* Items list */}
			<View
				style={[
					styles.itemsList,
					{ backgroundColor: theme.CardBackground },
					Shadow.sm,
				]}
			>
				{sortedItems.length > 0 ? (
					sortedItems.map((item, index) => (
						<ChecklistItem
							key={item.id}
							item={item}
							state={itemStates?.[item.id] || UNCHECKED}
							isFirst={index === 0}
							isLast={index === sortedItems.length - 1}
							onToggle={() => onToggleItem(checklist.id, item.id)}
						/>
					))
				) : (
					<View style={styles.emptyItemsContainer}>
						<Text variant="body" color="secondary">
							No items in this checklist
						</Text>
					</View>
				)}
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	checklistSection: {
		marginBottom: Spacing.xxl,
	},
	headerCard: {
		marginBottom: Spacing.lg,
	},
	titleContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	checklistTitle: {
		flex: 1,
	},
	completedIcon: {
		marginLeft: Spacing.sm,
	},
	progressContainer: {
		marginTop: Spacing.md,
		flexDirection: "row",
		alignItems: "center",
	},
	progressBar: {
		flex: 1,
		height: 8,
		borderRadius: BorderRadius.sm,
		overflow: "hidden",
		marginRight: Spacing.sm,
	},
	progressFill: {
		height: "100%",
		borderRadius: BorderRadius.sm,
	},
	progressText: {
		width: 40,
		textAlign: "right",
	},
	itemsList: {
		borderRadius: BorderRadius.md,
	},
	emptyItemsContainer: {
		padding: Spacing.lg,
		alignItems: "center",
		justifyContent: "center",
	},
});
