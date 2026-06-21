import React from "react";
import {
	View,
	StyleSheet,
	ViewStyle,
	StyleProp,
	TouchableOpacity,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Cream, Ink, Olive } from "../../constants/colors";
import { BorderRadius, Shadow } from "../../constants/tokens";

export type CardTone = "paper" | "cream" | "olive" | "ink";
export type CardElevation = "none" | "sm" | "md" | "lg";
export type CardPadding = "none" | "xs" | "sm" | "md" | "lg";

interface CardProps {
	children: React.ReactNode;
	onPress?: () => void;
	padding?: CardPadding;
	elevation?: CardElevation;
	tone?: CardTone;
	style?: StyleProp<ViewStyle>;
}

const PADDING_MAP: Record<CardPadding, number> = {
	none: 0,
	xs: 8,
	sm: 12,
	md: 16,
	lg: 20,
};

export const Card: React.FC<CardProps> = ({
	children,
	onPress,
	padding = "md",
	elevation = "sm",
	tone = "paper",
	style,
}) => {
	const { theme } = useTheme();

	const toneStyles = (() => {
		switch (tone) {
			case "cream":
				return {
					backgroundColor: Cream[50],
					borderColor: theme.BorderSoft,
				};
			case "olive":
				return {
					backgroundColor: Olive[100],
					borderColor: "transparent",
				};
			case "ink":
				return {
					backgroundColor: Ink[900],
					borderColor: "transparent",
				};
			default:
				return {
					backgroundColor: theme.Surface,
					borderColor: theme.BorderSoft,
				};
		}
	})();

	const shadow = tone === "ink" ? Shadow.lg : Shadow[elevation];

	const cardStyles = [
		styles.card,
		{
			padding: PADDING_MAP[padding],
			borderWidth: tone === "paper" || tone === "cream" ? 0.5 : 0,
			...toneStyles,
		},
		shadow,
		style,
	];

	if (onPress) {
		return (
			<TouchableOpacity
				style={cardStyles}
				onPress={onPress}
				activeOpacity={0.85}
			>
				{children}
			</TouchableOpacity>
		);
	}

	return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
	card: {
		borderRadius: BorderRadius.xl,
		width: "100%",
	},
});
