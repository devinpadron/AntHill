import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface ContainerProps {
	children: React.ReactNode;
	variant?: "default" | "card" | "page";
	padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
	style?: StyleProp<ViewStyle>;
}

export const Container: React.FC<ContainerProps> = ({
	children,
	variant = "default",
	padding = "md",
	style,
}) => {
	const { theme } = useTheme();

	const getBackgroundColor = () => {
		switch (variant) {
			case "card":
				return theme.CardBackground;
			case "page":
				return theme.Background;
			default:
				return "transparent";
		}
	};

	const getPadding = () => {
		switch (padding) {
			case "none":
				return 0;
			case "xs":
				return 4;
			case "sm":
				return 8;
			case "md":
				return 12;
			case "lg":
				return 16;
			case "xl":
				return 20;
			default:
				return 12;
		}
	};

	const containerStyles = [
		styles.container,
		{
			backgroundColor: getBackgroundColor(),
			padding: getPadding(),
		},
		variant === "card" && styles.card,
		style,
	];

	return <View style={containerStyles}>{children}</View>;
};

const styles = StyleSheet.create({
	container: {
		width: "100%",
	},
	card: {
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
});
