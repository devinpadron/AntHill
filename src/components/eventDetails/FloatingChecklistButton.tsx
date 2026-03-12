import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import {
	Spacing,
	IconSize,
	BorderRadius,
	Shadow,
} from "../../constants/tokens";

interface FloatingChecklistButtonProps {
	packages: any[];
	eventId: string;
	onNavigate: (checklistIds: string[], eventId: string) => void;
}

/**
 * FloatingChecklistButton - FAB that opens all checklists for the event
 */
export const FloatingChecklistButton: React.FC<
	FloatingChecklistButtonProps
> = ({ packages, eventId, onNavigate }) => {
	const { theme } = useTheme();

	const hasChecklists = packages.some(
		(pkg) => pkg.checklists && pkg.checklists.length > 0,
	);

	if (!hasChecklists) return null;

	const handlePress = () => {
		const checklistIds = Array.from(
			new Set(
				packages
					.flatMap((pkg) =>
						pkg.checklists && pkg.checklists.length > 0
							? pkg.checklists.map((checklist) =>
									typeof checklist === "string"
										? checklist
										: checklist.checklistId,
								)
							: [],
					)
					.filter(Boolean),
			),
		);
		onNavigate(checklistIds, eventId);
	};

	return (
		<TouchableOpacity
			style={[
				styles.floatingButton,
				{
					backgroundColor: theme.LocationBlue,
					...Shadow.lg,
				},
			]}
			onPress={handlePress}
		>
			<Ionicons
				name="checkbox-outline"
				size={IconSize.md}
				color={theme.CardBackground}
			/>
			<Text
				variant="body"
				weight="semibold"
				style={[styles.buttonText, { color: theme.CardBackground }]}
			>
				Checklists
			</Text>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	floatingButton: {
		position: "absolute",
		bottom: Spacing.xl,
		right: Spacing.xl,
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.round,
	},
	buttonText: {
		marginLeft: Spacing.sm,
		fontSize: 15,
	},
});
