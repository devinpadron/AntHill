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
	/**
	 * Lets the title and subtitle run to as many lines as they need.
	 *
	 * For rows whose text is COPY rather than data — a settings row explaining
	 * what a switch does has to be readable in full, and a row that ends in "…"
	 * is a setting nobody can act on. Data rows (names, event titles, companies)
	 * leave this off, where a long value truncating keeps the list scannable.
	 *
	 * Also the accessibility answer: at large system font sizes even short copy
	 * outgrows two lines, and a fixed cap turns that into an ellipsis rather
	 * than a taller row.
	 */
	multiline?: boolean;
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
	multiline = false,
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

				{/*
				 * Two lines, not one.
				 *
				 * The text slot is what is left after the icon and a trailing
				 * switch — roughly 260pt on a normal phone — and plenty of real
				 * setting titles are exactly that wide, so a one-line cap
				 * ellipsised them. `multiline` removes the cap altogether for
				 * rows whose text is copy the reader has to finish.
				 */}
				<View style={styles.textSlot}>
					<Text
						variant="body"
						color={tint}
						numberOfLines={multiline ? undefined : 2}
					>
						{title}
					</Text>
					{!!subtitle && (
						<Text
							variant="caption"
							color="textSecondary"
							numberOfLines={multiline ? undefined : 3}
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

				{/*
				 * The accessory needs its own inset.
				 *
				 * `value` and `chevron` each carry a marginLeft; the accessory
				 * carried none, so it sat flush against the text slot — and
				 * since that slot is flex:1, any title long enough to fill the
				 * row ended up touching the switch. It reads as the title being
				 * cut off by the control, which is exactly what it looks like on
				 * the rows whose titles now wrap to two lines.
				 */}
				{!!accessory && (
					<View style={styles.accessorySlot}>{accessory}</View>
				)}

				{selected && !accessory && (
					<Icon
						name="checkmark"
						size="md"
						color="accent"
						style={styles.accessorySlot}
					/>
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
			/*
			 * A token, not the old 2px. That gap was set when a title was one
			 * line and a subtitle two; now that both wrap, two lines of title
			 * sitting 2px off the subtitle read as one run-on paragraph rather
			 * than a heading and its explanation.
			 */
			marginTop: theme.spacing.xs,
		},
		value: {
			marginLeft: theme.spacing.md,
			maxWidth: "45%",
		},
		accessorySlot: {
			marginLeft: theme.spacing.md,
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
