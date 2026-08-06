import React, { useCallback, useState } from "react";
import {
	LayoutChangeEvent,
	Pressable,
	StyleProp,
	StyleSheet,
	View,
	ViewStyle,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	withSpring,
} from "react-native-reanimated";
import { haptics, Theme, useTheme, useThemedStyles } from "../../theme";
import { Icon, IconName } from "./Icon";
import { Text } from "./Text";

/**
 * A segmented picker.
 *
 * One control for three separate things the app hand-rolled: the animated
 * three-tab indicator in AvailabilityPage, the pill "radio buttons" that only
 * existed in CompanyPreferences, and the check-marked option lists in
 * UserPreferences.
 *
 * The thumb slides on the UI thread and is driven purely by measured layout, so
 * segments can hold labels of any length without the indicator drifting.
 */

export type Segment<T extends string> = {
	value: T;
	label: string;
	icon?: IconName;
	/** A count shown after the label — pending/confirmed/declined totals. */
	count?: number;
};

type SegmentedControlProps<T extends string> = {
	/*
	 * `NoInfer` keeps T pinned to whatever `value` is. Without it, an inline
	 * segments array widens T to plain `string`, and `onChange` stops accepting
	 * a setter for the caller's union type.
	 */
	segments: Segment<NoInfer<T>>[];
	value: T;
	onChange: (value: T) => void;
	/** Stretches each segment evenly. Off lets them size to content. */
	fullWidth?: boolean;
	style?: StyleProp<ViewStyle>;
};

/** Gap between the track's edge and the thumb. Drives the layout maths. */
const TRACK_PADDING = 3;

export function SegmentedControl<T extends string>({
	segments,
	value,
	onChange,
	fullWidth = true,
	style,
}: SegmentedControlProps<T>) {
	const theme = useTheme();
	const styles = useThemedStyles(segmentStyles);
	const [trackWidth, setTrackWidth] = useState(0);

	const index = Math.max(
		0,
		segments.findIndex((s) => s.value === value),
	);

	/*
	 * The thumb travels inside the track's PADDING box, not its full width.
	 *
	 * `onLayout` reports the border-box width, so dividing that by the segment
	 * count made each step one padding-width too wide — by the last segment the
	 * thumb had walked off the right edge by twice the padding. The segments
	 * themselves are `flex: 1` inside the same padding, so measuring the inner
	 * box is also what keeps the thumb aligned with its label.
	 */
	const innerWidth = Math.max(0, trackWidth - TRACK_PADDING * 2);
	const segmentWidth = innerWidth > 0 ? innerWidth / segments.length : 0;

	const onLayout = useCallback((event: LayoutChangeEvent) => {
		setTrackWidth(event.nativeEvent.layout.width);
	}, []);

	const thumbStyle = useAnimatedStyle(() => ({
		width: segmentWidth,
		transform: [
			{
				translateX: withSpring(
					index * segmentWidth,
					theme.motion.springPress,
				),
			},
		],
	}));

	return (
		<View
			style={[styles.track, style]}
			onLayout={onLayout}
			accessibilityRole="tablist"
		>
			{/* Hidden until measured, so it does not flash at x=0 on mount. */}
			{segmentWidth > 0 && (
				<Animated.View style={[styles.thumb, thumbStyle]} />
			)}

			{segments.map((segment) => {
				const active = segment.value === value;

				return (
					<Pressable
						key={segment.value}
						onPress={() => {
							if (active) return;
							haptics.selection();
							onChange(segment.value);
						}}
						style={[styles.segment, fullWidth && styles.flex]}
						accessibilityRole="tab"
						accessibilityState={{ selected: active }}
						accessibilityLabel={segment.label}
					>
						{!!segment.icon && (
							<Icon
								name={segment.icon}
								size="sm"
								color={active ? "text" : "textSecondary"}
								style={styles.icon}
							/>
						)}
						<Text
							variant="label"
							color={active ? "text" : "textSecondary"}
							numberOfLines={1}
						>
							{segment.label}
							{segment.count !== undefined
								? `  ${segment.count}`
								: ""}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const segmentStyles = (theme: Theme) =>
	StyleSheet.create({
		track: {
			flexDirection: "row",
			backgroundColor: theme.colors.surfaceSunken,
			borderRadius: theme.radius.md,
			padding: TRACK_PADDING,
		},
		thumb: {
			position: "absolute",
			top: TRACK_PADDING,
			left: TRACK_PADDING,
			bottom: TRACK_PADDING,
			borderRadius: theme.radius.sm + 1,
			backgroundColor: theme.colors.surface,
			...theme.elevation.raised,
		},
		segment: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			paddingVertical: theme.spacing.sm,
			paddingHorizontal: theme.spacing.md,
			minHeight: 36,
		},
		flex: {
			flex: 1,
		},
		icon: {
			marginRight: theme.spacing.xs,
		},
	});
