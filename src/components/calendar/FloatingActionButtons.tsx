import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { FAB, FABStack, useFloatingOffset } from "../ui";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/**
 * The calendar's floating actions.
 *
 * They fade out while a sheet is open, so the sheet is not competing with two
 * buttons hovering over it. The fade runs on the UI thread now rather than
 * through `Animated` on the JS thread, and both buttons share one stack instead
 * of each absolutely positioning itself with its own hardcoded offsets.
 */

type FloatingActionButtonsProps = {
	isAdmin: boolean;
	selectedDate: string | null;
	today: string;
	isBottomSheetVisible: boolean;
	onAddEvent: () => void;
	onFilterPress: () => void;
	onTodayPress: () => void;
};

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
	isAdmin,
	selectedDate,
	isBottomSheetVisible,
	onAddEvent,
	onFilterPress,
	onTodayPress,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(fabStyles);
	/* Same offset the FABStack opposite it uses, so the two line up. */
	const bottom = useFloatingOffset();

	/* Only meaningful once the user has pinned the list to a specific day. */
	const showTodayButton = selectedDate !== null;

	const fadeStyle = useAnimatedStyle(() => ({
		opacity: withTiming(isBottomSheetVisible ? 0 : 1, {
			duration: theme.motion.duration.base,
		}),
	}));

	if (!isAdmin && !showTodayButton) return null;

	return (
		<Animated.View
			style={[styles.layer, fadeStyle]}
			pointerEvents={isBottomSheetVisible ? "none" : "box-none"}
		>
			{showTodayButton && (
				<View style={[styles.leading, { bottom }]}>
					<FAB
						icon="arrow-undo-outline"
						onPress={onTodayPress}
						label="Back to all dates"
						variant="secondary"
						extended
					/>
				</View>
			)}

			{isAdmin && (
				<FABStack>
					<FAB
						icon="funnel-outline"
						onPress={onFilterPress}
						label="Filter events"
						variant="secondary"
					/>
					<FAB icon="add" onPress={onAddEvent} label="New event" />
				</FABStack>
			)}
		</Animated.View>
	);
};

const fabStyles = (theme: Theme) =>
	StyleSheet.create({
		layer: {
			...StyleSheet.absoluteFillObject,
		},
		leading: {
			position: "absolute",
			left: theme.spacing.lg,
		},
	});
