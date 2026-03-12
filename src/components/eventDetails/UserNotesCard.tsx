import React from "react";
import {
	View,
	StyleSheet,
	TextInput,
	Animated,
	TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, IconSize, BorderRadius } from "../../constants/tokens";

interface UserNotesCardProps {
	localNotes: string;
	setLocalNotes: (notes: string) => void;
	isEditingNotes: boolean;
	animatedOpacity: Animated.Value;
	handleDoubleTap: () => void;
	handleBlur: () => void;
}

/**
 * UserNotesCard - Editable personal notes with double-tap interaction
 */
export const UserNotesCard: React.FC<UserNotesCardProps> = ({
	localNotes,
	setLocalNotes,
	isEditingNotes,
	animatedOpacity,
	handleDoubleTap,
	handleBlur,
}) => {
	const { theme } = useTheme();

	return (
		<Card padding="md" elevation="md" style={styles.card}>
			<View style={styles.sectionHeaderContainer}>
				<Ionicons
					name="create-outline"
					size={IconSize.sm}
					color={theme.LocationBlue}
					style={styles.icon}
				/>
				<Text variant="body" weight="semibold" color="primary">
					Your Notes
					<Text
						variant="small"
						color="tertiary"
						italic
						style={styles.editHint}
					>
						{isEditingNotes
							? " (editing)"
							: " (double-tap to edit)"}
					</Text>
				</Text>
			</View>

			<TouchableOpacity
				activeOpacity={0.8}
				onPress={isEditingNotes ? undefined : handleDoubleTap}
				disabled={isEditingNotes}
			>
				<Animated.View
					style={[
						styles.notesContainer,
						{
							borderColor: theme.BorderColor,
							backgroundColor: theme.CardBackground,
						},
						isEditingNotes && {
							borderColor: theme.LocationBlue,
							backgroundColor: theme.Background,
						},
						!isEditingNotes && {
							opacity: animatedOpacity.interpolate({
								inputRange: [0, 0.5, 1],
								outputRange: [1, 0.8, 1],
							}),
						},
					]}
				>
					<TextInput
						style={[
							styles.notesInput,
							{ color: theme.PrimaryText },
						]}
						multiline
						editable={isEditingNotes}
						numberOfLines={5}
						value={localNotes}
						onChangeText={
							isEditingNotes ? setLocalNotes : undefined
						}
						onBlur={isEditingNotes ? handleBlur : undefined}
						placeholder="Add your personal notes here..."
						placeholderTextColor={theme.TertiaryText}
						contextMenuHidden={!isEditingNotes}
						pointerEvents={isEditingNotes ? "auto" : "none"}
					/>
				</Animated.View>
			</TouchableOpacity>
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		marginBottom: Spacing.lg,
	},
	sectionHeaderContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	icon: {
		marginRight: Spacing.sm,
	},
	editHint: {
		marginLeft: 6,
	},
	notesContainer: {
		borderWidth: 1,
		borderRadius: BorderRadius.md,
	},
	notesInput: {
		fontSize: 16,
		lineHeight: 22,
		padding: Spacing.md,
		minHeight: 120,
	},
});
