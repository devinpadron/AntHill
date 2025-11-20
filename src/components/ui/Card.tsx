import React from "react";
import {
	View,
	StyleSheet,
	ViewStyle,
	StyleProp,
	TouchableOpacity,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface CardProps {
	children: React.ReactNode;
	onPress?: () => void;
	padding?: "none" | "xs" | "sm" | "md" | "lg";
	elevation?: "none" | "sm" | "md" | "lg";
	style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({
	children,
	onPress,
	padding = "md",
	elevation = "md",
	style,
}) => {
	const { theme } = useTheme();

	const getPadding = () => {
		switch (padding) {
			case "none":
				return 0;
			case "xs":
				return 8;
			case "sm":
				return 12;
			case "md":
				return 16;
			case "lg":
				return 20;
			default:
				return 16;
		}
	};

	const getElevationStyles = () => {
		switch (elevation) {
			case "none":
				return {};
			case "sm":
				return {
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.05,
					shadowRadius: 2,
					elevation: 1,
				};
			case "md":
				return {
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.1,
					shadowRadius: 4,
					elevation: 3,
				};
			case "lg":
				return {
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 4 },
					shadowOpacity: 0.15,
					shadowRadius: 8,
					elevation: 5,
				};
			default:
				return {
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.1,
					shadowRadius: 4,
					elevation: 3,
				};
		}
	};

	const cardStyles = [
		styles.card,
		{
			backgroundColor: theme.CardBackground,
			padding: getPadding(),
		},
		getElevationStyles(),
		style,
	];

	if (onPress) {
		return (
			<TouchableOpacity
				style={cardStyles}
				onPress={onPress}
				activeOpacity={0.7}
			>
				{children}
			</TouchableOpacity>
		);
	}

	return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
	card: {
		borderRadius: 12,
		width: "100%",
	},
});
