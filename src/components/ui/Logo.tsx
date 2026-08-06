import React from "react";
import { Image, StyleProp, ImageStyle } from "react-native";
import { useTheme } from "../../theme";

/**
 * The AntHill wordmark.
 *
 * The asset is black artwork on transparency, which disappears against a dark
 * background — so it is tinted with the current text color rather than drawn
 * as-is. That keeps one asset serving both themes instead of shipping a second
 * white variant that would then have to be kept in sync.
 */

const WORDMARK = require("../../assets/AntHill/Full_Black.png");
const ICON = require("../../assets/AntHill/AH_Icon.png");

type LogoProps = {
	/** `wordmark` is the full lockup; `icon` is the ant alone. */
	variant?: "wordmark" | "icon";
	width?: number;
	height?: number;
	/** Skips the tint. For the rare case of drawing on a known light surface. */
	untinted?: boolean;
	style?: StyleProp<ImageStyle>;
};

export const Logo: React.FC<LogoProps> = ({
	variant = "wordmark",
	width = 180,
	height = 90,
	untinted = false,
	style,
}) => {
	const theme = useTheme();

	return (
		<Image
			source={variant === "icon" ? ICON : WORDMARK}
			resizeMode="contain"
			style={[
				{ width, height },
				!untinted && { tintColor: theme.colors.text },
				style,
			]}
			accessibilityRole="image"
			accessibilityLabel="AntHill"
		/>
	);
};
