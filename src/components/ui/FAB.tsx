import React, { useContext } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { Icon, IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

/**
 * A floating action button.
 *
 * The one place the design deliberately spends a shadow and a filled accent —
 * it has to read as sitting above the content it acts on.
 *
 * `FABStack` positions a column of them above the tab bar; the calendar's
 * add/filter pair is the motivating case.
 */

type FABProps = {
	icon: IconName;
	onPress: () => void;
	/** Spoken by a screen reader, and shown when `extended`. */
	label: string;
	/** Widens into a pill with the label beside the glyph. */
	extended?: boolean;
	/** `secondary` is a surface-colored FAB for the less important action. */
	variant?: "primary" | "secondary";
	visible?: boolean;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

export const FAB: React.FC<FABProps> = ({
	icon,
	onPress,
	label,
	extended = false,
	variant = "primary",
	visible = true,
	style,
	testID,
}) => {
	const styles = useThemedStyles(fabStyles);

	if (!visible) return null;

	const primary = variant === "primary";

	return (
		<Animated.View
			entering={FadeIn.duration(160)}
			exiting={FadeOut.duration(120)}
		>
			<Pressable
				onPress={onPress}
				haptic="press"
				accessibilityLabel={label}
				testID={testID}
				style={[
					styles.fab,
					extended && styles.extended,
					primary ? styles.primary : styles.secondary,
					style,
				]}
			>
				<Icon
					name={icon}
					size="md"
					color={primary ? "onAccent" : "text"}
				/>
				{extended && (
					<Text
						variant="bodyStrong"
						color={primary ? "onAccent" : "text"}
						style={styles.label}
					>
						{label}
					</Text>
				)}
			</Pressable>
		</Animated.View>
	);
};

/**
 * How far a floating control should sit above the bottom of its container.
 *
 * Inside the tab navigator the container already ends at the top of the tab
 * bar, which has itself consumed the home indicator — so adding the bottom
 * safe-area inset there counts it twice and leaves the FABs hovering well
 * clear of the tabs. Outside a tab navigator the inset is still needed.
 *
 * `BottomTabBarHeightContext` is read rather than `useBottomTabBarHeight()`
 * because the hook throws outside a tab navigator, and a hook cannot be called
 * conditionally to avoid that.
 */
export const useFloatingOffset = () => {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const insideTabs = useContext(BottomTabBarHeightContext) !== undefined;

	return (insideTabs ? 0 : insets.bottom) + theme.spacing.md;
};

/** Bottom-right column of FABs, sitting just above the tab bar. */
export const FABStack: React.FC<{
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}> = ({ children, style }) => {
	const styles = useThemedStyles(fabStyles);
	const bottom = useFloatingOffset();

	return (
		<Animated.View
			style={[styles.stack, { bottom }, style]}
			pointerEvents="box-none"
		>
			{children}
		</Animated.View>
	);
};

const fabStyles = (theme: Theme) =>
	StyleSheet.create({
		fab: {
			width: 52,
			height: 52,
			borderRadius: theme.radius.pill,
			alignItems: "center",
			justifyContent: "center",
			flexDirection: "row",
			...theme.elevation.floating,
		},
		extended: {
			width: "auto",
			paddingHorizontal: theme.spacing.lg,
		},
		primary: {
			backgroundColor: theme.colors.accent,
		},
		secondary: {
			backgroundColor: theme.colors.surface,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.border,
		},
		label: {
			marginLeft: theme.spacing.sm,
		},
		stack: {
			position: "absolute",
			right: theme.spacing.lg,
			alignItems: "flex-end",
			gap: theme.spacing.md,
		},
	});
