import React from "react";
import { View, StyleSheet, ViewStyle, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

interface DetailCardProps {
	children: React.ReactNode;
	onPress?: () => void;
	elevation?: "none" | "sm" | "md" | "lg";
	padding?: "none" | "sm" | "md" | "lg";
	noBorder?: boolean;
	style?: ViewStyle;
}

export const DetailCard: React.FC<DetailCardProps> = ({
	children,
	onPress,
	elevation = "md",
	padding = "md",
	noBorder = false,
	style,
}) => {
	const { theme } = useTheme();

	const getPadding = () => {
		switch (padding) {
			case "none":
				return 0;
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
					shadowRadius: 1,
					elevation: 1,
				};
			case "md":
				return {
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.1,
					shadowRadius: 2,
					elevation: 2,
				};
			case "lg":
				return {
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 2 },
					shadowOpacity: 0.15,
					shadowRadius: 4,
					elevation: 4,
				};
			default:
				return {
					shadowColor: "#000",
					shadowOffset: { width: 0, height: 1 },
					shadowOpacity: 0.1,
					shadowRadius: 2,
					elevation: 2,
				};
		}
	};

	const cardStyles = [
		styles.card,
		{
			backgroundColor: theme.CardBackground,
			borderColor: noBorder ? "transparent" : theme.DateBadge,
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
		borderWidth: 1,
		marginBottom: 12,
		overflow: "hidden",
	},
});
