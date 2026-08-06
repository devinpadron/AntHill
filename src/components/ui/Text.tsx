import React from "react";
import {
	Text as RNText,
	TextProps as RNTextProps,
	StyleProp,
	TextStyle,
} from "react-native";
import { useTheme } from "../../theme";
import { ColorTokens } from "../../theme/themes";
import { TypeVariant } from "../../theme/tokens";

/**
 * Typography.
 *
 * The app had 13 ad-hoc font sizes across 444 declarations, weights spelled two
 * ways, and no line heights — so text density drifted from screen to screen.
 * Every string goes through a variant here instead.
 *
 * The variant also carries `maxFontSizeMultiplier`, which is why this component
 * exists rather than a bag of style constants: the caps have to be applied to
 * the element, and leaving that to call sites means it never happens.
 */

type TextProps = Omit<RNTextProps, "style"> & {
	variant?: TypeVariant;
	/** A semantic color token, or a raw color. Defaults to `text`. */
	color?: keyof ColorTokens | (string & {});
	align?: TextStyle["textAlign"];
	/** Uppercases and applies the tracking that suits it. */
	uppercase?: boolean;
	style?: StyleProp<TextStyle>;
	children?: React.ReactNode;
};

export const Text: React.FC<TextProps> = ({
	variant = "body",
	color = "text",
	align,
	uppercase = false,
	style,
	children,
	...rest
}) => {
	const theme = useTheme();
	const token = theme.type[variant];

	const resolvedColor =
		color in theme.colors
			? theme.colors[color as keyof ColorTokens]
			: (color as string);

	return (
		<RNText
			{...rest}
			maxFontSizeMultiplier={
				rest.maxFontSizeMultiplier ?? token.maxFontSizeMultiplier
			}
			style={[
				{
					fontSize: token.fontSize,
					lineHeight: token.lineHeight,
					fontWeight: token.fontWeight,
					letterSpacing: token.letterSpacing,
					color: resolvedColor,
					textAlign: align,
				},
				uppercase && { textTransform: "uppercase" },
				style,
			]}
		>
			{children}
		</RNText>
	);
};
