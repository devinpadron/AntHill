import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Theme, useThemedStyles } from "../../theme";
import { ElevationVariant } from "../../theme/tokens";
import { Text } from "./Text";
import { Pressable } from "./Pressable";

/**
 * A content container.
 *
 * Replaces the white-background-plus-shadow block that 23 files each defined
 * for themselves, with radii of 8, 10 or 12 and shadows that mostly agreed but
 * not quite.
 *
 * The default is a hairline outline, not a shadow. Minimal surfaces read as
 * flat planes separated by lines; shadows are reserved for things that
 * genuinely float (sheets, FABs), which is what `elevation` is for.
 */

type CardProps = {
	children: React.ReactNode;
	/** Optional section label rendered above the content. */
	title?: string;
	/** Shown to the right of the title — a count, an action. */
	titleAccessory?: React.ReactNode;
	elevation?: ElevationVariant;
	/** Removes the inner padding, for cards holding a list or a map. */
	flush?: boolean;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

export const Card: React.FC<CardProps> = ({
	children,
	title,
	titleAccessory,
	elevation = "none",
	flush = false,
	onPress,
	style,
	testID,
}) => {
	const styles = useThemedStyles(cardStyles);

	const body = (
		<>
			{(!!title || !!titleAccessory) && (
				<View style={[styles.titleRow, flush && styles.titleRowFlush]}>
					{!!title && (
						<Text variant="label" color="textSecondary" uppercase>
							{title}
						</Text>
					)}
					{titleAccessory}
				</View>
			)}
			{children}
		</>
	);

	const containerStyle = [
		styles.card,
		!flush && styles.padded,
		elevation !== "none" && styles.elevated,
		style,
	];

	if (onPress) {
		return (
			<Pressable
				onPress={onPress}
				style={containerStyle}
				testID={testID}
				/* A card is a large target; scaling one looks wobbly. */
				scaleOnPress={false}
				android_ripple={undefined}
			>
				{body}
			</Pressable>
		);
	}

	return (
		<View style={containerStyle} testID={testID}>
			{body}
		</View>
	);
};

const cardStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			backgroundColor: theme.colors.surface,
			borderRadius: theme.radius.lg,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.border,
			overflow: "hidden",
		},
		padded: {
			padding: theme.spacing.lg,
		},
		elevated: {
			...theme.elevation.raised,
			borderWidth: 0,
		},
		titleRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: theme.spacing.md,
		},
		titleRowFlush: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.lg,
		},
	});
