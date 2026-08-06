import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Theme, useThemedStyles } from "../../theme";
import { Haptic } from "../../theme/haptics";
import { ColorTokens } from "../../theme/themes";
import { Icon, IconName } from "./Icon";
import { Pressable } from "./Pressable";

/**
 * An icon-only action.
 *
 * The design leans on glyphs wherever one is unambiguous, so this is a heavily
 * used primitive — which is why `label` is REQUIRED rather than optional. An
 * icon with no text is invisible to a screen reader unless something names it,
 * and making that a type error is the only way it stays true across 25 screens.
 */

export type IconButtonVariant =
	/** Bare glyph. The default — headers, list rows, inline actions. */
	| "plain"
	/** Tinted circle. For an action that needs to read as a button. */
	| "soft"
	/** Filled accent circle. One per screen at most. */
	| "solid";

type IconButtonProps = {
	name: IconName;
	onPress: () => void;
	/** Spoken by a screen reader. Not displayed. */
	label: string;
	variant?: IconButtonVariant;
	size?: "sm" | "md" | "lg";
	/** Overrides the glyph color. Use `danger` for destructive actions. */
	color?: keyof ColorTokens;
	disabled?: boolean;
	haptic?: Haptic | null;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

const GLYPH: Record<"sm" | "md" | "lg", "sm" | "md" | "lg"> = {
	sm: "sm",
	md: "md",
	lg: "lg",
};

export const IconButton: React.FC<IconButtonProps> = ({
	name,
	onPress,
	label,
	variant = "plain",
	size = "md",
	color,
	disabled = false,
	haptic = "tap",
	style,
	testID,
}) => {
	const styles = useThemedStyles(iconButtonStyles);

	const glyphColor: keyof ColorTokens =
		color ?? (variant === "solid" ? "onAccent" : "text");

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			haptic={haptic}
			testID={testID}
			accessibilityLabel={label}
			accessibilityRole="button"
			style={[
				styles.base,
				styles[`${size}Size`],
				variant === "soft" && styles.soft,
				variant === "solid" && styles.solid,
				style,
			]}
			/*
			 * A bare glyph is smaller than the 44pt minimum, so the touch area
			 * is extended past the visual bounds rather than padding the layout.
			 */
			hitSlop={variant === "plain" ? 10 : 0}
		>
			<Icon name={name} size={GLYPH[size]} color={glyphColor} />
		</Pressable>
	);
};

const iconButtonStyles = (theme: Theme) =>
	StyleSheet.create({
		base: {
			alignItems: "center",
			justifyContent: "center",
			borderRadius: theme.radius.pill,
		},
		smSize: { width: 32, height: 32 },
		mdSize: { width: theme.hitTarget, height: theme.hitTarget },
		lgSize: { width: 52, height: 52 },
		soft: {
			backgroundColor: theme.colors.accentSubtle,
		},
		solid: {
			backgroundColor: theme.colors.accent,
		},
	});
