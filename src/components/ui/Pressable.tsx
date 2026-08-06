import React, { useCallback } from "react";
import {
	Pressable as RNPressable,
	PressableProps as RNPressableProps,
	StyleProp,
	ViewStyle,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
import { haptics, useTheme } from "../../theme";
import { Haptic } from "../../theme/haptics";

/**
 * The press behaviour every tappable thing in the app shares.
 *
 * Buttons, rows, cards and icon buttons all settle by the same scale, on the
 * same spring, and fire the same haptic — rather than each one picking its own
 * `activeOpacity`. Reanimated drives the scale on the UI thread, so it stays
 * smooth while the JS thread is busy with a Firestore write.
 */

const AnimatedPressable = Animated.createAnimatedComponent(RNPressable);

export type PressableProps = Omit<RNPressableProps, "style"> & {
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
	/** Which haptic to fire on press. `null` for none. Defaults to a tap. */
	haptic?: Haptic | null;
	/** Set false for large surfaces where a scale would look wobbly. */
	scaleOnPress?: boolean;
	/** Overrides the settled scale for unusually large or small targets. */
	pressedScale?: number;
};

export const Pressable: React.FC<PressableProps> = ({
	children,
	style,
	haptic = "tap",
	scaleOnPress = true,
	pressedScale,
	onPressIn,
	onPressOut,
	disabled,
	...rest
}) => {
	const theme = useTheme();
	const scale = useSharedValue(1);

	const target = pressedScale ?? theme.motion.pressScale;

	const handlePressIn: RNPressableProps["onPressIn"] = useCallback(
		(event) => {
			if (scaleOnPress) {
				scale.value = withSpring(target, theme.motion.springPress);
			}
			/*
			 * Fired on press-IN, not on press, so the feedback lands with the
			 * finger rather than after the handler's work.
			 */
			if (haptic) haptics[haptic]();

			onPressIn?.(event);
		},
		[
			scaleOnPress,
			scale,
			target,
			theme.motion.springPress,
			haptic,
			onPressIn,
		],
	);

	const handlePressOut: RNPressableProps["onPressOut"] = useCallback(
		(event) => {
			if (scaleOnPress) {
				scale.value = withSpring(1, theme.motion.springPress);
			}
			onPressOut?.(event);
		},
		[scaleOnPress, scale, theme.motion.springPress, onPressOut],
	);

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.value }],
	}));

	return (
		<AnimatedPressable
			{...rest}
			disabled={disabled}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			style={[style, animatedStyle, disabled && { opacity: 0.5 }]}
			accessibilityRole={rest.accessibilityRole ?? "button"}
			accessibilityState={{
				disabled: !!disabled,
				...rest.accessibilityState,
			}}
		>
			{children}
		</AnimatedPressable>
	);
};
