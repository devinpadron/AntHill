import React from "react";
import {
	ActivityIndicator,
	StyleProp,
	StyleSheet,
	TextStyle,
	View,
	ViewStyle,
} from "react-native";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { Haptic } from "../../theme/haptics";
import { ColorTokens } from "../../theme/themes";
import { Icon, IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

/**
 * The button.
 *
 * The prop shape is unchanged from the version this replaces, so existing call
 * sites keep working; what changed is that every value now comes from tokens.
 * Previously the primary color was a hardcoded `#2089dc` that did not appear in
 * the palette, which is why LoginPage had to override `style`, `textStyle`,
 * background and radius just to get a brand-colored button.
 *
 * `icon` also accepts an Ionicons name now, so the common case no longer needs
 * a caller-constructed element with its own hardcoded size and color.
 */

export type ButtonVariant =
	"primary" | "secondary" | "outline" | "text" | "destructive";
export type ButtonSize = "small" | "medium" | "large";

type ButtonProps = {
	onPress: () => void;
	title?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	disabled?: boolean;
	loading?: boolean;
	/** An Ionicons name, or a ready-made element for the rare custom case. */
	icon?: IconName | React.ReactNode;
	iconPosition?: "left" | "right" | "center";
	fullWidth?: boolean;
	style?: StyleProp<ViewStyle>;
	textStyle?: StyleProp<TextStyle>;
	selected?: boolean;
	haptic?: Haptic | null;
	/** Spoken by a screen reader when there is no title. */
	accessibilityLabel?: string;
	testID?: string;
};

/** Foreground color per variant — used by the label, icon and spinner alike. */
const FOREGROUND: Record<ButtonVariant, keyof ColorTokens> = {
	primary: "onAccent",
	secondary: "text",
	outline: "accent",
	text: "accent",
	destructive: "textInverse",
};

const TEXT_VARIANT: Record<ButtonSize, "label" | "bodyStrong" | "heading"> = {
	small: "label",
	medium: "bodyStrong",
	large: "heading",
};

export const Button: React.FC<ButtonProps> = ({
	title,
	onPress,
	variant = "primary",
	size = "medium",
	disabled = false,
	loading = false,
	icon,
	iconPosition = "left",
	fullWidth = false,
	style,
	textStyle,
	selected = false,
	haptic = "tap",
	accessibilityLabel,
	testID,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(buttonStyles);

	const foreground: keyof ColorTokens = disabled
		? "textTertiary"
		: FOREGROUND[variant];

	const glyph =
		typeof icon === "string" ? (
			<Icon
				name={icon as IconName}
				size={size === "small" ? "sm" : "md"}
				color={foreground}
			/>
		) : (
			icon
		);

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled || loading}
			haptic={disabled || loading ? null : haptic}
			testID={testID}
			accessibilityLabel={accessibilityLabel ?? title}
			style={[
				styles.base,
				styles[`${variant}Variant`],
				styles[`${size}Size`],
				selected && styles.selected,
				disabled && styles.disabled,
				fullWidth && styles.fullWidth,
				style,
			]}
		>
			{loading ? (
				<ActivityIndicator
					size="small"
					color={theme.colors[foreground]}
				/>
			) : (
				<View style={styles.content}>
					{!!glyph && iconPosition === "left" && (
						<View style={title ? styles.iconLeft : undefined}>
							{glyph}
						</View>
					)}
					{!!title && (
						<Text
							variant={TEXT_VARIANT[size]}
							color={foreground}
							style={textStyle}
						>
							{title}
						</Text>
					)}
					{!!glyph && iconPosition === "center" && glyph}
					{!!glyph && iconPosition === "right" && (
						<View style={title ? styles.iconRight : undefined}>
							{glyph}
						</View>
					)}
				</View>
			)}
		</Pressable>
	);
};

const buttonStyles = (theme: Theme) =>
	StyleSheet.create({
		base: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			borderRadius: theme.radius.md,
			borderWidth: theme.hairlineWidth,
			borderColor: "transparent",
			minHeight: theme.hitTarget,
		},

		primaryVariant: {
			backgroundColor: theme.colors.accent,
		},
		secondaryVariant: {
			backgroundColor: theme.colors.surfaceSunken,
		},
		outlineVariant: {
			backgroundColor: "transparent",
			borderColor: theme.colors.accentBorder,
		},
		textVariant: {
			backgroundColor: "transparent",
			minHeight: 0,
		},
		destructiveVariant: {
			backgroundColor: theme.colors.danger,
		},

		smallSize: {
			paddingVertical: theme.spacing.sm,
			paddingHorizontal: theme.spacing.md,
			minHeight: 36,
		},
		mediumSize: {
			paddingVertical: theme.spacing.md,
			paddingHorizontal: theme.spacing.lg,
		},
		largeSize: {
			paddingVertical: theme.spacing.lg,
			paddingHorizontal: theme.spacing.xl,
			minHeight: 52,
		},

		selected: {
			backgroundColor: theme.colors.accentSubtle,
			borderColor: theme.colors.accentBorder,
		},
		/*
		 * Disabled flattens to the sunken surface for every variant — including
		 * destructive, whose disabled styles existed in the old version but
		 * were never reachable by its style-composition logic.
		 */
		disabled: {
			backgroundColor: theme.colors.surfaceSunken,
			borderColor: "transparent",
		},
		fullWidth: {
			width: "100%",
		},

		content: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
		},
		iconLeft: {
			marginRight: theme.spacing.sm,
		},
		iconRight: {
			marginLeft: theme.spacing.sm,
		},
	});
