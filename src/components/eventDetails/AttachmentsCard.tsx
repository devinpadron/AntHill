import React from "react";
import { StyleSheet } from "react-native";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import AttachmentGallery from "../ui/AttachmentGallery";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, IconSize } from "../../constants/tokens";

interface AttachmentsCardProps {
	attachments: any[];
}

/**
 * AttachmentsCard - Displays event attachments in a gallery
 */
export const AttachmentsCard: React.FC<AttachmentsCardProps> = ({
	attachments,
}) => {
	const { theme } = useTheme();

	if (!attachments || attachments.length === 0) return null;

	return (
		<Card padding="md" elevation="md" style={styles.card}>
			<View style={styles.sectionHeaderContainer}>
				<Ionicons
					name="attach-outline"
					size={IconSize.sm}
					color={theme.LocationBlue}
					style={styles.icon}
				/>
				<Text variant="body" weight="semibold" color="primary">
					Attachments ({attachments.length})
				</Text>
			</View>
			<AttachmentGallery attachments={attachments} />
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
});
