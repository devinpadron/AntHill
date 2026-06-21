import React from "react";
import { View, Text } from "react-native";
import { AntGlyph } from "./AntGlyph";
import { Ink } from "../../../constants/colors";
import { FontFamily } from "../../../constants/tokens";

interface AntMarkProps {
	size?: number;
	color?: string;
}

/**
 * Lowercase "anthill" wordmark + abstract ant glyph.
 * The `size` argument controls the glyph diameter; the wordmark scales with it.
 */
export const AntMark: React.FC<AntMarkProps> = ({
	size = 18,
	color = Ink[900],
}) => {
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 6,
			}}
		>
			<AntGlyph size={size + 2} color={color} />
			<Text
				style={{
					fontFamily: FontFamily.display,
					fontSize: size + 2,
					letterSpacing: -0.2,
					lineHeight: size + 4,
					color,
				}}
			>
				anthill
			</Text>
		</View>
	);
};
