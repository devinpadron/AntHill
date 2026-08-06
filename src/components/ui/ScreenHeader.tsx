import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
	Extrapolation,
	interpolate,
	SharedValue,
	useAnimatedStyle,
} from "react-native-reanimated";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { ColorTokens } from "../../theme/themes";
import { IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

/**
 * The app's header. There is exactly one.
 *
 * Every route sets `headerShown: false`, so before this there were five
 * hand-rolled headers with three different paddings, three title sizes, and
 * three separate hacks for faking a centered title (`marginRight: 34`, a
 * `<View style={{width: 40}}/>` spacer, and absolute positioning).
 *
 * Centering here is structural: the leading and trailing slots are given the
 * same width, computed from whichever side holds more, so the title sits on the
 * true center no matter how many actions there are.
 */

export type HeaderAction = {
	icon: IconName;
	onPress: () => void;
	/** Spoken by a screen reader. */
	label: string;
	color?: keyof ColorTokens;
	disabled?: boolean;
};

type ScreenHeaderProps = {
	title: string;
	subtitle?: string;
	onBack?: () => void;
	actions?: HeaderAction[];
	/**
	 * `large` — left-aligned display title, for a section's root screen.
	 * `compact` — centered title on one row, for pushed detail screens.
	 */
	variant?: "large" | "compact";
	/**
	 * A scroll position. When given, the bottom hairline fades in as content
	 * scrolls under the header instead of always being drawn.
	 */
	scrollY?: SharedValue<number>;
	/** Arbitrary content below the title — a search field, a week picker. */
	children?: React.ReactNode;
	style?: StyleProp<ViewStyle>;
};

const SLOT = 44;

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
	title,
	subtitle,
	onBack,
	actions = [],
	variant = "compact",
	scrollY,
	children,
	style,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(headerStyles);

	const slotWidth = Math.max(onBack ? SLOT : 0, actions.length * SLOT);

	const borderStyle = useAnimatedStyle(() => {
		if (!scrollY) return { opacity: 1 };

		return {
			opacity: interpolate(
				scrollY.value,
				[0, 12],
				[0, 1],
				Extrapolation.CLAMP,
			),
		};
	});

	const back = onBack ? (
		<IconButton
			name="chevron-back"
			onPress={onBack}
			label="Go back"
			size="md"
		/>
	) : null;

	const trailing = actions.map((action) => (
		<IconButton
			key={action.label}
			name={action.icon}
			onPress={action.onPress}
			label={action.label}
			color={action.color}
			disabled={action.disabled}
		/>
	));

	return (
		<View style={[styles.root, style]}>
			{variant === "compact" ? (
				<View style={styles.row}>
					<View style={[styles.slot, { width: slotWidth }]}>
						{back}
					</View>

					<View style={styles.titleCenter}>
						<Text variant="heading" numberOfLines={1}>
							{title}
						</Text>
						{!!subtitle && (
							<Text
								variant="caption"
								color="textSecondary"
								numberOfLines={1}
							>
								{subtitle}
							</Text>
						)}
					</View>

					<View
						style={[
							styles.slot,
							styles.slotEnd,
							{ width: slotWidth },
						]}
					>
						{trailing}
					</View>
				</View>
			) : (
				<View style={styles.large}>
					{/*
					 * Only a back button gets its own row above the title. The
					 * actions sit BESIDE the title — giving them a row of their
					 * own pushed the title down by a full 44pt target on every
					 * root screen that has an action but no back button, which
					 * is most of them.
					 */}
					{!!back && <View style={styles.largeBackRow}>{back}</View>}

					<View style={styles.largeTitleRow}>
						<View style={styles.largeTitleText}>
							<Text variant="display" numberOfLines={2}>
								{title}
							</Text>
							{!!subtitle && (
								<Text
									variant="body"
									color="textSecondary"
									style={styles.largeSubtitle}
								>
									{subtitle}
								</Text>
							)}
						</View>

						{trailing.length > 0 && (
							<View style={styles.largeActions}>{trailing}</View>
						)}
					</View>
				</View>
			)}

			{children}

			<Animated.View style={[styles.border, borderStyle]} />
		</View>
	);
};

const headerStyles = (theme: Theme) =>
	StyleSheet.create({
		root: {
			backgroundColor: theme.colors.surface,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: theme.spacing.sm,
			minHeight: 52,
		},
		slot: {
			flexDirection: "row",
			alignItems: "center",
		},
		slotEnd: {
			justifyContent: "flex-end",
		},
		titleCenter: {
			flex: 1,
			alignItems: "center",
			paddingHorizontal: theme.spacing.xs,
		},
		large: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.xs,
			paddingBottom: theme.spacing.md,
		},
		largeBackRow: {
			flexDirection: "row",
			alignItems: "center",
			marginLeft: -theme.spacing.sm,
			marginBottom: theme.spacing.xs,
		},
		largeTitleRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
		},
		largeTitleText: {
			flex: 1,
		},
		largeSubtitle: {
			marginTop: theme.spacing.xs,
		},
		largeActions: {
			flexDirection: "row",
			alignItems: "center",
			/* Pulls the glyph flush with the gutter the title sits on. */
			marginRight: -theme.spacing.sm,
		},
		border: {
			height: theme.hairlineWidth,
			backgroundColor: theme.colors.border,
		},
	});
