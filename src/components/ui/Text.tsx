import React from "react";
import {
	Text as RNText,
	TextProps as RNTextProps,
	StyleSheet,
} from "react-native";
import { Clock } from "../../constants/colors";
import { useTheme } from "../../contexts/ThemeContext";

export type TextVariant = "h1" | "h2" | "h3" | "body" | "caption" | "small";

export type TextColor =
	| "primary"
	| "secondary"
	| "tertiary"
	| "white"
	| "black"
	| "error"
	| "success"
	| "info";

interface TextComponentProps extends RNTextProps {
	variant?: TextVariant;
	color?: TextColor;
	align?: "left" | "center" | "right" | "justify";
	weight?: "normal" | "medium" | "semibold" | "bold";
	italic?: boolean;
	underline?: boolean;
	children: React.ReactNode;
}

export const Text: React.FC<TextComponentProps> = ({
	variant = "body",
	color = "primary",
	align = "left",
	weight,
	italic = false,
	underline = false,
	style,
	children,
	...props
}) => {
	const { theme } = useTheme();

	// Dynamic color mapping based on theme
	const getColor = () => {
		switch (color) {
			case "primary":
				return theme.PrimaryText;
			case "secondary":
				return theme.SecondaryText;
			case "tertiary":
				return theme.TertiaryText;
			case "white":
				return theme.CardBackground;
			case "black":
				return theme.PrimaryText;
			case "error":
				return Clock.ClockOut;
			case "success":
				return Clock.ClockIn;
			case "info":
				return theme.LocationBlue;
			default:
				return theme.PrimaryText;
		}
	};

	const textStyles = [
		styles[variant],
		{ color: getColor() },
		{ textAlign: align },
		weight && styles[`weight_${weight}`],
		italic && styles.italic,
		underline && styles.underline,
		style,
	];

	return (
		<RNText style={textStyles} {...props}>
			{children}
		</RNText>
	);
};

const styles = StyleSheet.create({
	// Variants
	h1: {
		fontSize: 32,
		fontWeight: "700",
		lineHeight: 40,
	},
	h2: {
		fontSize: 24,
		fontWeight: "600",
		lineHeight: 32,
	},
	h3: {
		fontSize: 20,
		fontWeight: "600",
		lineHeight: 28,
	},
	body: {
		fontSize: 16,
		fontWeight: "400",
		lineHeight: 24,
	},
	caption: {
		fontSize: 14,
		fontWeight: "400",
		lineHeight: 20,
	},
	small: {
		fontSize: 12,
		fontWeight: "400",
		lineHeight: 16,
	},

	// Weights
	weight_normal: {
		fontWeight: "400",
	},
	weight_medium: {
		fontWeight: "500",
	},
	weight_semibold: {
		fontWeight: "600",
	},
	weight_bold: {
		fontWeight: "700",
	},

	// Styles
	italic: {
		fontStyle: "italic",
	},
	underline: {
		textDecorationLine: "underline",
	},
});
