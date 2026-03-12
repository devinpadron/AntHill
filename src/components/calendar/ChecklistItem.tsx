import React from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius, IconSize } from "../../constants/tokens";
import {
	UNCHECKED,
	CHECKED,
	STRIKETHROUGH,
} from "../../hooks/calendar/useEventChecklists";

interface ChecklistItemProps {
	item: { id: string; text: string };
	state: number;
	isFirst: boolean;
	isLast: boolean;
	onToggle: () => void;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
	item,
	state,
	isFirst,
	isLast,
	onToggle,
}) => {
	const { theme } = useTheme();

	return (
		<TouchableOpacity
			style={[
				styles.checklistItem,
				{
					backgroundColor: theme.CardBackground,
					borderBottomColor: theme.DateBadge,
				},
				isFirst && styles.firstItem,
				isLast && styles.lastItem,
			]}
			onPress={onToggle}
			activeOpacity={0.7}
		>
			<View style={styles.itemContent}>
				<View style={styles.checkboxContainer}>
					{state === UNCHECKED && (
						<View
							style={[
								styles.uncheckedBox,
								{ borderColor: theme.TertiaryText },
							]}
						/>
					)}
					{state === CHECKED && (
						<Ionicons
							name="checkmark-circle"
							size={IconSize.md}
							color={theme.NotificationGreen}
						/>
					)}
					{state === STRIKETHROUGH && (
						<Ionicons
							name="checkmark-circle"
							size={IconSize.md}
							color={theme.TertiaryText}
						/>
					)}
				</View>

				<Text
					variant="body"
					color={
						state === CHECKED
							? "success"
							: state === STRIKETHROUGH
								? "tertiary"
								: "primary"
					}
					style={[
						styles.itemText,
						state === STRIKETHROUGH && styles.strikethroughText,
					]}
				>
					{item.text}
				</Text>
			</View>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	checklistItem: {
		borderBottomWidth: 1,
		padding: Spacing.lg,
	},
	firstItem: {
		borderTopLeftRadius: BorderRadius.md,
		borderTopRightRadius: BorderRadius.md,
	},
	lastItem: {
		borderBottomLeftRadius: BorderRadius.md,
		borderBottomRightRadius: BorderRadius.md,
		borderBottomWidth: 0,
	},
	itemContent: {
		flexDirection: "row",
		alignItems: "center",
	},
	checkboxContainer: {
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
		marginRight: Spacing.md,
	},
	uncheckedBox: {
		width: 22,
		height: 22,
		borderWidth: 2,
		borderRadius: 22,
	},
	itemText: {
		flex: 1,
	},
	strikethroughText: {
		textDecorationLine: "line-through",
	},
});
