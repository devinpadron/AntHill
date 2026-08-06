import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { ColorTokens } from "../../theme/themes";
import { Icon, IconName } from "./Icon";
import { Text } from "./Text";

/**
 * A status pill.
 *
 * Replaces the inline `getPrivilegeColor()`-style switches that returned raw
 * background/foreground hex pairs — one in EmployeeList, others for time entry
 * and availability statuses, each with its own palette.
 *
 * The tone names a MEANING, not a color, so a "pending" badge is the same
 * amber everywhere and flips correctly in dark mode.
 */

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type BadgeProps = {
	label: string;
	tone?: BadgeTone;
	icon?: IconName;
	/** Filled reads louder; use it for the one status that needs attention. */
	variant?: "subtle" | "solid";
	/** A small dot instead of a glyph. Good for dense list rows. */
	dot?: boolean;
	style?: StyleProp<ViewStyle>;
};

const TONE: Record<
	BadgeTone,
	{ fg: keyof ColorTokens; bg: keyof ColorTokens; solidFg: keyof ColorTokens }
> = {
	neutral: {
		fg: "textSecondary",
		bg: "surfaceSunken",
		solidFg: "textInverse",
	},
	accent: { fg: "accent", bg: "accentSubtle", solidFg: "onAccent" },
	success: { fg: "success", bg: "successSubtle", solidFg: "textInverse" },
	warning: { fg: "warning", bg: "warningSubtle", solidFg: "textInverse" },
	danger: { fg: "danger", bg: "dangerSubtle", solidFg: "textInverse" },
};

export const Badge: React.FC<BadgeProps> = ({
	label,
	tone = "neutral",
	icon,
	variant = "subtle",
	dot = false,
	style,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(badgeStyles);

	const palette = TONE[tone];
	const solid = variant === "solid";
	const fg = solid ? palette.solidFg : palette.fg;

	return (
		<View
			style={[
				styles.badge,
				{
					backgroundColor: solid
						? theme.colors[palette.fg]
						: theme.colors[palette.bg],
				},
				style,
			]}
		>
			{dot && (
				<View
					style={[styles.dot, { backgroundColor: theme.colors[fg] }]}
				/>
			)}
			{!!icon && !dot && (
				<Icon name={icon} size="xs" color={fg} style={styles.icon} />
			)}
			<Text variant="caption" color={fg} numberOfLines={1}>
				{label}
			</Text>
		</View>
	);
};

const badgeStyles = (theme: Theme) =>
	StyleSheet.create({
		badge: {
			flexDirection: "row",
			alignItems: "center",
			alignSelf: "flex-start",
			paddingHorizontal: theme.spacing.sm,
			paddingVertical: 3,
			borderRadius: theme.radius.pill,
		},
		dot: {
			width: 6,
			height: 6,
			borderRadius: 3,
			marginRight: theme.spacing.xs + 2,
		},
		icon: {
			marginRight: theme.spacing.xs,
		},
	});
