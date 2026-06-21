import React from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import { Text } from "./Text";
import {
	Olive,
	Terra,
	Amber,
	Rust,
	Info,
	Cream,
	Ink,
} from "../../constants/colors";
import { FontFamily } from "../../constants/tokens";

export type PillTone =
	| "neutral"
	| "olive"
	| "terra"
	| "amber"
	| "rust"
	| "info"
	| "cream"
	| "ink";

interface PillProps {
	children: React.ReactNode;
	tone?: PillTone;
	style?: StyleProp<ViewStyle>;
}

const TONE_MAP: Record<PillTone, { bg: string; fg: string }> = {
	neutral: { bg: "rgba(29,29,39,0.05)", fg: Ink[700] },
	olive: { bg: Olive[100], fg: Olive[700] },
	terra: { bg: Terra[100], fg: Terra[700] },
	amber: { bg: Amber[100], fg: Amber[600] },
	rust: { bg: Rust[100], fg: Rust[600] },
	info: { bg: Info[100], fg: Info[500] },
	cream: { bg: Cream[200], fg: Ink[700] },
	ink: { bg: Ink[900], fg: Cream[50] },
};

export const Pill: React.FC<PillProps> = ({
	children,
	tone = "neutral",
	style,
}) => {
	const { bg, fg } = TONE_MAP[tone];
	return (
		<View
			style={[
				{
					alignSelf: "flex-start",
					flexDirection: "row",
					alignItems: "center",
					gap: 5,
					paddingHorizontal: 10,
					paddingVertical: 4,
					borderRadius: 999,
					backgroundColor: bg,
				},
				style,
			]}
		>
			<Text
				style={{
					color: fg,
					fontSize: 12,
					fontFamily: FontFamily.ui,
					fontWeight: "600",
					letterSpacing: -0.1,
					lineHeight: 14,
				}}
			>
				{children}
			</Text>
		</View>
	);
};
