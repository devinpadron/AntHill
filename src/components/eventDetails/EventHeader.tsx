import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, IconSize } from "../../constants/tokens";

type EventHeaderProps = {
	title: string;
	onBack: () => void;
	onEdit?: () => void;
	canEdit?: boolean;
};

export const EventHeader = ({
	title,
	onBack,
	onEdit,
	canEdit = false,
}: EventHeaderProps) => {
	const { theme } = useTheme();

	return (
		<View style={[styles.header, { borderBottomColor: theme.BorderColor }]}>
			<TouchableOpacity style={styles.backButton} onPress={onBack}>
				<Ionicons
					name="chevron-back"
					size={28}
					color={theme.PrimaryText}
				/>
			</TouchableOpacity>

			<View style={styles.titleContainer}>
				<Text
					variant="h3"
					weight="bold"
					align="center"
					color="primary"
					numberOfLines={2}
					ellipsizeMode="tail"
				>
					{title}
				</Text>
			</View>

			{canEdit && onEdit && (
				<TouchableOpacity style={styles.editButton} onPress={onEdit}>
					<Ionicons
						name="create-outline"
						size={28}
						color={theme.PrimaryText}
					/>
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		display: "flex",
		flexDirection: "row",
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.md,
		borderBottomWidth: 1,
		alignItems: "center",
		minHeight: 60,
	},
	titleContainer: {
		flex: 1,
		paddingHorizontal: Spacing.md - 2,
	},
	backButton: {
		width: 40,
		zIndex: 1,
		paddingRight: Spacing.sm,
	},
	editButton: {
		width: 40,
		zIndex: 1,
		paddingLeft: Spacing.sm,
	},
});
