import React from "react";
import {
	TouchableOpacity,
	Text,
	StyleSheet,
	ActivityIndicator,
	View,
	StyleProp,
	ViewStyle,
	TextStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Clock } from "../../constants/colors";

export type ButtonVariant =
	| "primary"
	| "secondary"
	| "outline"
	| "text"
	| "destructive";
export type ButtonSize = "small" | "medium" | "large";

type ButtonProps = {
	onPress: () => void;
	title?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
	disabled?: boolean;
	loading?: boolean;
	icon?: React.ReactNode;
	iconPosition?: "left" | "right" | "center";
	fullWidth?: boolean;
	style?: StyleProp<ViewStyle>;
	textStyle?: StyleProp<TextStyle>;
	selected?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
	title,
	onPress,
	variant = "primary",
	size = "medium",
	disabled = false,
	loading = false,
	icon,
	iconPosition = "left",
	fullWidth = false,
	style,
	textStyle,
	selected = false,
}) => {
	const { theme } = useTheme();

	// Dynamic button background colors
	const getButtonBackgroundColor = () => {
		if (disabled) return theme.DateBadge;

		switch (variant) {
			case "primary":
				return theme.LocationBlue;
			case "secondary":
				return theme.DateBadge;
			case "outline":
				return "transparent";
			case "text":
				return "transparent";
			case "destructive":
				return Clock.ClockOut;
			default:
				return theme.LocationBlue;
		}
	};

	// Dynamic text colors
	const getTextColor = () => {
		if (disabled) return theme.TertiaryText;

		switch (variant) {
			case "primary":
				return theme.CardBackground;
			case "secondary":
				return theme.PrimaryText;
			case "outline":
				return theme.LocationBlue;
			case "text":
				return theme.LocationBlue;
			case "destructive":
				return theme.CardBackground;
			default:
				return theme.CardBackground;
		}
	};

	// Dynamic border color for outline variant
	const getBorderColor = () => {
		if (variant === "outline") {
			return disabled ? theme.TertiaryText : theme.LocationBlue;
		}
		return "transparent";
	};

	const buttonStyles = [
		styles.button,
		styles[`${size}Button`],
		{
			backgroundColor: getButtonBackgroundColor(),
			borderColor: getBorderColor(),
			borderWidth: variant === "outline" ? 1 : 0,
		},
		selected && { backgroundColor: theme.SearchBar },
		fullWidth && styles.fullWidth,
		style,
	];

	const textStyles = [
		styles.text,
		styles[`${size}Text`],
		{ color: getTextColor() },
		selected && variant === "text" && { fontWeight: "bold" as const },
		textStyle,
	];

	const spinnerColor =
		variant === "primary" || variant === "destructive"
			? theme.CardBackground
			: theme.LocationBlue;

	return (
		<TouchableOpacity
			style={buttonStyles}
			onPress={onPress}
			disabled={disabled || loading}
			activeOpacity={0.7}
		>
			{loading ? (
				<ActivityIndicator size="small" color={spinnerColor} />
			) : (
				<View style={styles.contentContainer}>
					{icon && iconPosition === "left" && (
						<View style={styles.iconLeft}>{icon}</View>
					)}
					{title && <Text style={textStyles}>{title}</Text>}
					{icon && iconPosition === "center" && (
						<View style={styles.iconCenter}>{icon}</View>
					)}
					{icon && iconPosition === "right" && (
						<View style={styles.iconRight}>{icon}</View>
					)}
				</View>
			)}
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	button: {
		borderRadius: 8,
		justifyContent: "center",
		alignItems: "center",
		flexDirection: "row",
	},
	smallButton: {
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	mediumButton: {
		paddingVertical: 10,
		paddingHorizontal: 16,
	},
	largeButton: {
		paddingVertical: 14,
		paddingHorizontal: 20,
	},
	fullWidth: {
		width: "100%",
	},
	text: {
		textAlign: "center",
		fontWeight: "500",
		fontSize: 16,
	},
	smallText: {
		fontSize: 14,
	},
	mediumText: {
		fontSize: 16,
	},
	largeText: {
		fontSize: 18,
	},
	contentContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	iconLeft: {
		marginRight: 8,
	},
	iconRight: {
		marginLeft: 8,
	},
	iconCenter: {
		alignContent: "center",
		justifyContent: "center",
	},
});
