import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Theme, useThemedStyles } from "../../theme";
import { ColorTokens } from "../../theme/themes";
import { Icon, IconName } from "./Icon";
import { Pressable } from "./Pressable";
import { Text } from "./Text";

/**
 * A tappable row.
 *
 * Generalizes `SettingsItem` — whose destructive style was literally
 * `color: "red"` — into the row used by settings, member lists, pickers and
 * option lists alike.
 *
 * Grouped rows draw their separator inset past the leading icon, which is what
 * makes a run of them read as one list rather than a stack of bars.
 */

type ListRowProps = {
	title: string;
	subtitle?: string;
	/** Leading glyph. Also sets the separator inset. */
	icon?: IconName;
	iconColor?: keyof ColorTokens;
	/** Right-aligned secondary text — a value, a count, a time. */
	value?: string;
	/** Anything on the trailing edge: a Switch, a Badge, a chevron. */
	accessory?: React.ReactNode;
	/** Draws the disclosure chevron. Defaults on when `onPress` is given. */
	chevron?: boolean;
	/** Renders in the danger color. For log out, delete, remove. */
	destructive?: boolean;
	selected?: boolean;
	disabled?: boolean;
	onPress?: () => void;
	onLongPress?: () => void;
	/** Draws the bottom separator. Off for the last row in a group. */
	separator?: boolean;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

export const ListRow: React.FC<ListRowProps> = ({
	title,
	subtitle,
	icon,
	iconColor,
	value,
	accessory,
	chevron,
	destructive = false,
	selected = false,
	disabled = false,
	onPress,
	onLongPress,
	separator = true,
	style,
	testID,
}) => {
	const styles = useThemedStyles(listRowStyles);

	const showChevron = chevron ?? (!!onPress && !accessory);
	const tint: keyof ColorTokens = destructive ? "danger" : "text";

	const body = (
		<>
			<View style={styles.row}>
				{!!icon && (
					<View style={styles.iconSlot}>
						<Icon
							name={icon}
							size="md"
							color={
								iconColor ??
								(destructive ? "danger" : "textSecondary")
							}
						/>
					</View>
				)}

				<View style={styles.textSlot}>
					<Text variant="body" color={tint} numberOfLines={1}>
						{title}
					</Text>
					{!!subtitle && (
						<Text
							variant="caption"
							color="textSecondary"
							numberOfLines={2}
							style={styles.subtitle}
						>
							{subtitle}
						</Text>
					)}
				</View>

				{!!value && (
					<Text
						variant="body"
						color="textSecondary"
						numberOfLines={1}
						style={styles.value}
					>
						{value}
					</Text>
				)}

				{accessory}

				{selected && !accessory && (
					<Icon name="checkmark" size="md" color="accent" />
				)}

				{showChevron && (
					<Icon
						name="chevron-forward"
						size="sm"
						color="textTertiary"
						style={styles.chevron}
					/>
				)}
			</View>

			{separator && (
				<View
					style={[styles.separator, !!icon && styles.separatorInset]}
				/>
			)}
		</>
	);

	const containerStyle = [
		styles.container,
		selected && styles.selected,
		style,
	];

	if (!onPress && !onLongPress) {
		return (
			<View style={containerStyle} testID={testID}>
				{body}
			</View>
		);
	}

	return (
		<Pressable
			onPress={onPress ?? (() => {})}
			onLongPress={onLongPress}
			disabled={disabled}
			style={containerStyle}
			scaleOnPress={false}
			haptic="selection"
			testID={testID}
			accessibilityLabel={title}
			accessibilityState={{ selected, disabled }}
		>
			{body}
		</Pressable>
	);
};

const listRowStyles = (theme: Theme) =>
	StyleSheet.create({
		container: {
			backgroundColor: theme.colors.surface,
		},
		selected: {
			backgroundColor: theme.colors.accentSubtle,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: theme.hitTarget + 8,
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.md,
		},
		iconSlot: {
			width: 28,
			alignItems: "flex-start",
			marginRight: theme.spacing.md,
		},
		textSlot: {
			flex: 1,
		},
		subtitle: {
			marginTop: 2,
		},
		value: {
			marginLeft: theme.spacing.md,
			maxWidth: "45%",
		},
		chevron: {
			marginLeft: theme.spacing.sm,
		},
		separator: {
			height: theme.hairlineWidth,
			backgroundColor: theme.colors.border,
			marginLeft: theme.spacing.lg,
		},
		separatorInset: {
			marginLeft: theme.spacing.lg + 28 + theme.spacing.md,
		},
	});
