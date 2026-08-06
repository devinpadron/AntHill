import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	LinearTransition,
	useAnimatedStyle,
	withTiming,
} from "react-native-reanimated";
import { Icon, Pressable, Text } from "../ui";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/**
 * An accordion group of settings rows.
 *
 * Reanimated drives the expand now — the previous version needed
 * `LayoutAnimation` plus an Android `UIManager.setLayoutAnimationEnabled`
 * opt-in at module scope, which is a global side effect for one component.
 *
 * The chevron rotates rather than swapping glyphs, so the transition reads as
 * one control moving rather than two icons cross-fading.
 */

type ExpandableSettingsSectionProps = {
	title: string;
	children: React.ReactNode;
	initiallyExpanded?: boolean;
};

export const ExpandableSettingsSection: React.FC<
	ExpandableSettingsSectionProps
> = ({ title, children, initiallyExpanded = false }) => {
	const theme = useTheme();
	const styles = useThemedStyles(sectionStyles);
	const [expanded, setExpanded] = useState(initiallyExpanded);

	const chevronStyle = useAnimatedStyle(() => ({
		transform: [
			{
				rotate: withTiming(expanded ? "180deg" : "0deg", {
					duration: theme.motion.duration.base,
				}),
			},
		],
	}));

	return (
		<Animated.View layout={LinearTransition.duration(200)}>
			<Pressable
				onPress={() => setExpanded((v) => !v)}
				haptic="selection"
				scaleOnPress={false}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				accessibilityLabel={title}
				style={styles.header}
			>
				<Text variant="body" style={styles.flex}>
					{title}
				</Text>
				<Animated.View style={chevronStyle}>
					<Icon name="chevron-down" size="sm" color="textTertiary" />
				</Animated.View>
			</Pressable>

			{expanded && (
				<Animated.View
					entering={FadeIn.duration(160)}
					exiting={FadeOut.duration(120)}
				>
					<View style={styles.divider} />
					{children}
				</Animated.View>
			)}
		</Animated.View>
	);
};

const sectionStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: theme.hitTarget + 8,
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.md,
			backgroundColor: theme.colors.surface,
		},
		divider: {
			height: theme.hairlineWidth,
			backgroundColor: theme.colors.border,
			marginLeft: theme.spacing.lg,
		},
	});
