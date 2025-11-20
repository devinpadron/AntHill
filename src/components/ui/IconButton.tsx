import React from "react";
import {
	TouchableOpacity,
	StyleSheet,
	ViewStyle,
	StyleProp,
	ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

interface IconButtonProps {
	icon: keyof typeof Ionicons.glyphMap;
	onPress: () => void;
	size?: "sm" | "md" | "lg";
	variant?: "solid" | "outline" | "ghost";
	color?: "primary" | "secondary" | "destructive" | "success";
	disabled?: boolean;
	loading?: boolean;
	style?: StyleProp<ViewStyle>;
}

export const IconButton: React.FC<IconButtonProps> = ({
	icon,
	onPress,
	size = "md",
	variant = "ghost",
	color = "primary",
	disabled = false,
	loading = false,
	style,
}) => {
	const { theme } = useTheme();

	const getIconSize = () => {
		switch (size) {
			case "sm":
				return 18;
			case "md":
				return 24;
			case "lg":
				return 30;
			default:
				return 24;
		}
	};

	const getButtonSize = () => {
		switch (size) {
			case "sm":
				return 32;
			case "md":
				return 40;
			case "lg":
				return 48;
			default:
				return 40;
		}
	};

	const getIconColor = () => {
		if (disabled) return theme.TertiaryText;

		switch (color) {
			case "primary":
				return variant === "solid"
					? theme.CardBackground
					: theme.LocationBlue;
			case "secondary":
				return variant === "solid"
					? theme.PrimaryText
					: theme.SecondaryText;
			case "destructive":
				return variant === "solid" ? theme.CardBackground : "#f44336";
			case "success":
				return variant === "solid"
					? theme.CardBackground
					: theme.NotificationGreen;
			default:
				return theme.LocationBlue;
		}
	};

	const getBackgroundColor = () => {
		if (disabled)
			return variant === "solid" ? theme.DateBadge : "transparent";
		if (variant === "ghost") return "transparent";
		if (variant === "outline") return "transparent";

		switch (color) {
			case "primary":
				return theme.LocationBlue;
			case "secondary":
				return theme.DateBadge;
			case "destructive":
				return "#f44336";
			case "success":
				return theme.NotificationGreen;
			default:
				return theme.LocationBlue;
		}
	};

	const getBorderColor = () => {
		if (variant !== "outline") return "transparent";
		if (disabled) return theme.TertiaryText;

		switch (color) {
			case "primary":
				return theme.LocationBlue;
			case "secondary":
				return theme.SecondaryText;
			case "destructive":
				return "#f44336";
			case "success":
				return theme.NotificationGreen;
			default:
				return theme.LocationBlue;
		}
	};

	const buttonSize = getButtonSize();
	const iconSize = getIconSize();
	const iconColor = getIconColor();

	const buttonStyles = [
		styles.button,
		{
			width: buttonSize,
			height: buttonSize,
			borderRadius: buttonSize / 2,
			backgroundColor: getBackgroundColor(),
			borderColor: getBorderColor(),
			borderWidth: variant === "outline" ? 1 : 0,
		},
		style,
	];

	return (
		<TouchableOpacity
			style={buttonStyles}
			onPress={onPress}
			disabled={disabled || loading}
			activeOpacity={0.7}
		>
			{loading ? (
				<ActivityIndicator size="small" color={iconColor} />
			) : (
				<Ionicons name={icon} size={iconSize} color={iconColor} />
			)}
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	button: {
		justifyContent: "center",
		alignItems: "center",
	},
});
