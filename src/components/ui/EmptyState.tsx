import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { Button } from "./Button";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing } from "../../constants/tokens";

interface EmptyStateProps {
	icon?: keyof typeof Ionicons.glyphMap;
	title: string;
	message?: string;
	actionLabel?: string;
	onAction?: () => void;
}

/**
 * EmptyState - A reusable component for displaying empty states
 *
 * Use this component whenever a list, screen, or section has no data to display.
 * It provides a consistent UI for communicating "nothing here yet" scenarios.
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon="calendar-outline"
 *   title="No events found"
 *   message="Create your first event to get started"
 *   actionLabel="Create Event"
 *   onAction={() => navigation.navigate('CreateEvent')}
 * />
 * ```
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
	icon = "document-outline",
	title,
	message,
	actionLabel,
	onAction,
}) => {
	const { theme } = useTheme();

	return (
		<View style={styles.container}>
			<Ionicons name={icon} size={64} color={theme.TertiaryText} />
			<Text variant="h3" color="primary" style={styles.title}>
				{title}
			</Text>
			{message && (
				<Text
					variant="body"
					color="secondary"
					align="center"
					style={styles.message}
				>
					{message}
				</Text>
			)}
			{actionLabel && onAction && (
				<Button
					variant="primary"
					title={actionLabel}
					onPress={onAction}
					style={styles.button}
				/>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: Spacing.xl,
	},
	title: {
		marginTop: Spacing.lg,
	},
	message: {
		marginTop: Spacing.sm,
		maxWidth: 300,
	},
	button: {
		marginTop: Spacing.lg,
	},
});
