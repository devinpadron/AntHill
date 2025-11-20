import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Text } from "./Text";
import { useTheme } from "../../contexts/ThemeContext";

interface BadgeProps {
	children: React.ReactNode;
	variant?: "default" | "primary" | "success" | "warning" | "error" | "info";
	size?: "sm" | "md" | "lg";
	style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
	children,
	variant = "default",
	size = "md",
	style,
}) => {
	const { theme } = useTheme();

	const getBackgroundColor = () => {
		switch (variant) {
			case "primary":
				return theme.LocationBlue;
			case "success":
				return theme.NotificationGreen;
			case "warning":
				return "#ff9800";
			case "error":
				return "#f44336";
			case "info":
				return "#2196f3";
			case "default":
			default:
				return theme.DateBadge;
		}
	};

	const getTextColor = () => {
		switch (variant) {
			case "primary":
			case "success":
			case "warning":
			case "error":
			case "info":
				return theme.CardBackground;
			case "default":
			default:
				return theme.PrimaryText;
		}
	};

	const getPadding = () => {
		switch (size) {
			case "sm":
				return { paddingHorizontal: 6, paddingVertical: 2 };
			case "md":
				return { paddingHorizontal: 8, paddingVertical: 4 };
			case "lg":
				return { paddingHorizontal: 12, paddingVertical: 6 };
			default:
				return { paddingHorizontal: 8, paddingVertical: 4 };
		}
	};

	const getTextVariant = () => {
		switch (size) {
			case "sm":
				return "small" as const;
			case "md":
				return "caption" as const;
			case "lg":
				return "body" as const;
			default:
				return "caption" as const;
		}
	};

	const badgeStyles = [
		styles.badge,
		{
			backgroundColor: getBackgroundColor(),
			...getPadding(),
		},
		style,
	];

	return (
		<View style={badgeStyles}>
			<Text
				variant={getTextVariant()}
				style={{ color: getTextColor() }}
				weight="semibold"
			>
				{children}
			</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	badge: {
		borderRadius: 12,
		alignSelf: "flex-start",
		justifyContent: "center",
		alignItems: "center",
	},
});
