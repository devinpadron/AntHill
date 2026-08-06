import React from "react";
import { StyleProp, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { ColorTokens } from "../../theme/themes";
import { IconSizeToken } from "../../theme/tokens";

/**
 * The app's only icon component.
 *
 * The codebase had four icon libraries in play — Ionicons, two
 * `react-native-vector-icons` families, and `react-native-feather` — so the
 * same idea (back, edit, delete) was drawn in three different styles depending
 * on which screen you were on. Everything routes through Ionicons here, and
 * every call site goes through this component so size and color come from
 * tokens rather than literals.
 */

export type IconName = keyof typeof Ionicons.glyphMap;

type IconProps = {
	name: IconName;
	/** A size token, or an explicit number when a layout demands one. */
	size?: IconSizeToken | number;
	/**
	 * A semantic color token ("accent", "textSecondary", …) or a raw color.
	 * Defaults to `text`, so an icon is legible in both themes for free.
	 */
	color?: keyof ColorTokens | (string & {});
	style?: StyleProp<TextStyle>;
};

export const Icon: React.FC<IconProps> = ({
	name,
	size = "md",
	color = "text",
	style,
}) => {
	const theme = useTheme();

	const resolvedSize = typeof size === "number" ? size : theme.iconSize[size];

	const resolvedColor =
		color in theme.colors
			? theme.colors[color as keyof ColorTokens]
			: (color as string);

	return (
		<Ionicons
			name={name}
			size={resolvedSize}
			color={resolvedColor}
			style={style}
			/*
			 * Glyphs are decoration next to their label, or are labelled by the
			 * IconButton wrapping them. Either way the icon itself should not
			 * be an extra stop for a screen reader.
			 */
			accessible={false}
			importantForAccessibility="no"
		/>
	);
};
