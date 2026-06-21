import React from "react";
import {
	Text as RNText,
	TextProps as RNTextProps,
	StyleSheet,
	TextStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import {
	FontFamily,
	FontSize,
	LineHeight,
	LetterSpacing,
} from "../../constants/tokens";

export type TextVariant =
	| "display"
	| "displayLg"
	| "h1"
	| "h2"
	| "h3"
	| "body"
	| "caption"
	| "small"
	| "eyebrow"
	| "mono";

export type TextColor =
	| "primary"
	| "secondary"
	| "tertiary"
	| "white"
	| "black"
	| "accent"
	| "warm"
	| "error"
	| "success"
	| "info";

export type TextWeight = "normal" | "medium" | "semibold" | "bold";

interface TextComponentProps extends RNTextProps {
	variant?: TextVariant;
	color?: TextColor;
	align?: "left" | "center" | "right" | "justify";
	weight?: TextWeight;
	italic?: boolean;
	underline?: boolean;
	children: React.ReactNode;
}

const SERIF_VARIANTS = new Set<TextVariant>(["display", "displayLg"]);

function resolveFontFamily(
	variant: TextVariant,
	weight: TextWeight | undefined,
	italic: boolean,
): string {
	if (SERIF_VARIANTS.has(variant) || italic) {
		return italic ? FontFamily.displayItalic : FontFamily.display;
	}
	if (variant === "mono") {
		return weight === "medium" ? "GeistMono-Medium" : FontFamily.mono;
	}
	switch (weight) {
		case "medium":
			return "Geist-Medium";
		case "semibold":
			return "Geist-SemiBold";
		case "bold":
			return "Geist-Bold";
		default:
			return FontFamily.ui;
	}
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

	const getColor = (): string => {
		switch (color) {
			case "secondary":
				return theme.SecondaryText;
			case "tertiary":
				return theme.TertiaryText;
			case "white":
				return theme.Surface;
			case "black":
				return theme.PrimaryText;
			case "accent":
				return theme.AccentStrong;
			case "warm":
				return theme.Warm;
			case "error":
				return theme.Error;
			case "success":
				return theme.Success;
			case "info":
				return theme.InfoStrong;
			case "primary":
			default:
				return theme.PrimaryText;
		}
	};

	const textStyles: TextStyle[] = [
		styles[variant],
		{
			color: getColor(),
			textAlign: align,
			fontFamily: resolveFontFamily(variant, weight, italic),
		},
		underline ? styles.underline : null,
	].filter(Boolean) as TextStyle[];

	return (
		<RNText style={[textStyles, style]} {...props}>
			{children}
		</RNText>
	);
};

const styles = StyleSheet.create({
	display: {
		fontSize: FontSize.display,
		lineHeight: LineHeight.display,
		letterSpacing: LetterSpacing.tight,
	},
	displayLg: {
		fontSize: FontSize.displayLg,
		lineHeight: LineHeight.displayLg,
		letterSpacing: LetterSpacing.tight,
	},
	h1: {
		fontSize: FontSize.h1,
		lineHeight: LineHeight.h1,
		letterSpacing: LetterSpacing.tighter,
	},
	h2: {
		fontSize: FontSize.h2,
		lineHeight: LineHeight.h2,
		letterSpacing: LetterSpacing.tighter,
	},
	h3: {
		fontSize: FontSize.h3,
		lineHeight: LineHeight.h3,
		letterSpacing: LetterSpacing.tighter,
	},
	body: {
		fontSize: FontSize.body,
		lineHeight: LineHeight.body,
	},
	caption: {
		fontSize: FontSize.caption,
		lineHeight: LineHeight.caption,
	},
	small: {
		fontSize: FontSize.small,
		lineHeight: LineHeight.small,
	},
	eyebrow: {
		fontSize: 11,
		lineHeight: 14,
		letterSpacing: LetterSpacing.eyebrow,
		textTransform: "uppercase",
	},
	mono: {
		fontSize: FontSize.body,
		lineHeight: LineHeight.body,
		letterSpacing: -0.2,
	},
	underline: {
		textDecorationLine: "underline",
	},
});
