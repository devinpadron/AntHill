import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Theme, useThemedStyles } from "../../theme";
import { Button } from "./Button";
import { Icon, IconName } from "./Icon";
import { Text } from "./Text";

/**
 * The "nothing here" state.
 *
 * Six screens each wrote their own — some with an icon and a call to action,
 * several with a single line of gray text, and some with nothing at all. An
 * empty list is the first thing a new company sees, so it gets a real design
 * and, where there is something to do about it, a way to act.
 */

type EmptyStateProps = {
	icon: IconName;
	title: string;
	description?: string;
	/** The action that resolves the emptiness — "Create a checklist". */
	actionLabel?: string;
	onAction?: () => void;
	/** Renders inside a list rather than filling the screen. */
	compact?: boolean;
	style?: StyleProp<ViewStyle>;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
	icon,
	title,
	description,
	actionLabel,
	onAction,
	compact = false,
	style,
}) => {
	const styles = useThemedStyles(emptyStyles);

	return (
		<View style={[styles.root, compact && styles.compact, style]}>
			<View style={styles.iconWell}>
				<Icon name={icon} size="xl" color="textTertiary" />
			</View>

			<Text variant="heading" align="center" style={styles.title}>
				{title}
			</Text>

			{!!description && (
				<Text
					variant="body"
					color="textSecondary"
					align="center"
					style={styles.description}
				>
					{description}
				</Text>
			)}

			{!!actionLabel && !!onAction && (
				<Button
					title={actionLabel}
					onPress={onAction}
					variant="secondary"
					icon="add"
					style={styles.action}
				/>
			)}
		</View>
	);
};

const emptyStyles = (theme: Theme) =>
	StyleSheet.create({
		root: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: theme.spacing.xl,
			paddingVertical: theme.spacing["3xl"],
		},
		compact: {
			flex: 0,
			paddingVertical: theme.spacing.xl,
		},
		iconWell: {
			width: 72,
			height: 72,
			borderRadius: theme.radius.pill,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: theme.colors.surfaceSunken,
			marginBottom: theme.spacing.lg,
		},
		title: {
			marginBottom: theme.spacing.xs,
		},
		description: {
			maxWidth: 320,
		},
		action: {
			marginTop: theme.spacing.xl,
		},
	});
