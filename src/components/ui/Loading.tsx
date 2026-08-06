import React, { useEffect } from "react";
import {
	ActivityIndicator,
	DimensionValue,
	StyleProp,
	StyleSheet,
	View,
	ViewStyle,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { Text } from "./Text";

/**
 * Loading states.
 *
 * 25 files each inlined an `ActivityIndicator` with its own color — including
 * a raw `#0000ff` that matched nothing in the app. Spinners here always take
 * the accent.
 */

type LoadingProps = {
	/** Fills its parent and centers. Off renders inline. */
	fill?: boolean;
	label?: string;
	size?: "small" | "large";
	style?: StyleProp<ViewStyle>;
};

export const Loading: React.FC<LoadingProps> = ({
	fill = true,
	label,
	size = "large",
	style,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(loadingStyles);

	return (
		<View style={[fill && styles.fill, style]}>
			<ActivityIndicator size={size} color={theme.colors.accent} />
			{!!label && (
				<Text variant="body" color="textSecondary" style={styles.label}>
					{label}
				</Text>
			)}
		</View>
	);
};

/**
 * A shimmering placeholder.
 *
 * Preferable to a spinner wherever the shape of the incoming content is known —
 * a settings list, a roster, a week of time entries — because the layout does
 * not jump when the data lands.
 */
export const Skeleton: React.FC<{
	width?: DimensionValue;
	height?: number;
	radius?: number;
	style?: StyleProp<ViewStyle>;
}> = ({ width = "100%", height = 16, radius, style }) => {
	const theme = useTheme();
	const opacity = useSharedValue(0.5);

	useEffect(() => {
		opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
	}, [opacity]);

	const animatedStyle = useAnimatedStyle(() => ({
		opacity: opacity.value,
	}));

	return (
		<Animated.View
			style={[
				{
					width,
					height,
					borderRadius: radius ?? theme.radius.sm,
					backgroundColor: theme.colors.skeleton,
				},
				animatedStyle,
				style,
			]}
		/>
	);
};

/** A run of skeleton rows shaped like a list. */
export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
	const styles = useThemedStyles(loadingStyles);

	return (
		<View style={styles.skeletonList}>
			{Array.from({ length: rows }).map((_, i) => (
				<View key={i} style={styles.skeletonRow}>
					<Skeleton width={28} height={28} radius={999} />
					<View style={styles.skeletonText}>
						<Skeleton width="60%" height={14} />
						<Skeleton
							width="35%"
							height={11}
							style={{ marginTop: 6 }}
						/>
					</View>
				</View>
			))}
		</View>
	);
};

const loadingStyles = (theme: Theme) =>
	StyleSheet.create({
		fill: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
		},
		label: {
			marginTop: theme.spacing.md,
		},
		skeletonList: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.lg,
		},
		skeletonRow: {
			flexDirection: "row",
			alignItems: "center",
			paddingVertical: theme.spacing.md,
		},
		skeletonText: {
			flex: 1,
			marginLeft: theme.spacing.md,
		},
	});
