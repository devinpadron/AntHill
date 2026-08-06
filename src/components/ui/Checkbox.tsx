import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
	useAnimatedStyle,
	withSpring,
} from "react-native-reanimated";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { Icon } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

/**
 * A checkbox.
 *
 * The previous version drew its tick as a `<Text>✓</Text>`, which sat slightly
 * off-center and did not scale with the box; it is a real glyph now, and the
 * box springs when it fills.
 *
 * `radio` swaps the square for a circle. Same control, same behaviour — the
 * shape is the only thing that tells a user whether the choice is exclusive.
 */

type CheckboxProps = {
	checked: boolean;
	onPress: () => void;
	/** Optional — a bare box is valid in a dense list or a table cell. */
	label?: string;
	description?: string;
	disabled?: boolean;
	radio?: boolean;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

export const Checkbox: React.FC<CheckboxProps> = ({
	checked,
	onPress,
	label,
	description,
	disabled = false,
	radio = false,
	style,
	testID,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(checkboxStyles);

	const boxStyle = useAnimatedStyle(() => ({
		transform: [
			{ scale: withSpring(checked ? 1 : 0.92, theme.motion.springPress) },
		],
	}));

	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			haptic="selection"
			scaleOnPress={false}
			style={[styles.row, style]}
			testID={testID}
			accessibilityRole={radio ? "radio" : "checkbox"}
			accessibilityState={{ checked, disabled }}
			accessibilityLabel={label}
		>
			<Animated.View
				style={[
					styles.box,
					radio && styles.radio,
					checked && styles.boxChecked,
					boxStyle,
				]}
			>
				{checked &&
					(radio ? (
						<View style={styles.radioDot} />
					) : (
						<Icon name="checkmark" size={16} color="onAccent" />
					))}
			</Animated.View>

			{!!label && (
				<View style={styles.textSlot}>
					<Text variant="body">{label}</Text>
					{!!description && (
						<Text
							variant="caption"
							color="textSecondary"
							style={styles.description}
						>
							{description}
						</Text>
					)}
				</View>
			)}
		</Pressable>
	);
};

const checkboxStyles = (theme: Theme) =>
	StyleSheet.create({
		row: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: theme.hitTarget,
			paddingVertical: theme.spacing.xs,
		},
		box: {
			width: 22,
			height: 22,
			borderRadius: theme.radius.sm - 2,
			borderWidth: 1.5,
			borderColor: theme.colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		radio: {
			borderRadius: theme.radius.pill,
		},
		boxChecked: {
			backgroundColor: theme.colors.accent,
			borderColor: theme.colors.accent,
		},
		radioDot: {
			width: 8,
			height: 8,
			borderRadius: 4,
			backgroundColor: theme.colors.onAccent,
		},
		textSlot: {
			flex: 1,
			marginLeft: theme.spacing.md,
		},
		description: {
			marginTop: 2,
		},
	});
