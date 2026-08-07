import React, { useCallback, useEffect, useState } from "react";
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

	/*
	 * The thumb follows the segments' MEASURED geometry rather than an assumed
	 * even split.
	 *
	 * It used to be `trackWidth / segments.length`, which is only right when
	 * every segment is the same width — true under `fullWidth`, where they are
	 * all `flex: 1`, and false the moment they size to their content. With
	 * `fullWidth={false}` and labels of different lengths ("2024" beside "All
	 * time") the thumb took even steps under uneven labels, so it sat visibly
	 * off the text it was supposed to be highlighting, drifting further along
	 * the row.
	 *
	 * Measuring each segment costs one layout pass and makes the two modes the
	 * same code path instead of one correct case and one silent trap.
	 */
	const [layouts, setLayouts] = useState<{ x: number; width: number }[]>([]);

	const index = Math.max(
		0,
		segments.findIndex((s) => s.value === value),
	);

	const current = layouts[index];

	const onSegmentLayout = useCallback(
		(position: number) => (event: LayoutChangeEvent) => {
			const { x, width } = event.nativeEvent.layout;
			setLayouts((prev) => {
				const existing = prev[position];
				if (existing?.x === x && existing?.width === width) return prev;
				const next = [...prev];
				next[position] = { x, width };
				return next;
			});
		},
		[],
	);

	/*
	 * Stale entries would otherwise keep a thumb sized to a segment that no
	 * longer exists. Every remaining segment re-reports its layout on the next
	 * pass, so a single frame with no thumb is the whole cost.
	 */
	useEffect(() => {
		setLayouts((prev) => (prev.length ? [] : prev));
	}, [segments.length]);

	const thumbStyle = useAnimatedStyle(() => ({
		width: current?.width ?? 0,
		transform: [
			{
				/*
				 * `x` is already relative to the track's padding box, and the
				 * thumb is positioned at that same inset — so this is a plain
				 * offset with no padding arithmetic. The old version had to
				 * subtract TRACK_PADDING twice and got it wrong once.
				 */
				translateX: withSpring(
					current?.x ?? 0,
					theme.motion.springPress,
				),
			},
		],
	}));

	return (
		<View style={[styles.track, style]} accessibilityRole="tablist">
			{/* Hidden until measured, so it does not flash at x=0 on mount. */}
			{!!current?.width && (
				<Animated.View style={[styles.thumb, thumbStyle]} />
			)}

			{segments.map((segment, position) => {
				const active = segment.value === value;

				return (
					<Pressable
						key={segment.value}
						onLayout={onSegmentLayout(position)}
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
			/*
			 * ZERO, not TRACK_PADDING. translateX now carries a segment's own
			 * measured `x`, which already includes the track's padding — an
			 * inset here would be counted twice and push the thumb 3px right of
			 * every label.
			 */
			left: 0,
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
