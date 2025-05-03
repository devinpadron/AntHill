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
	// Determine the styles based on props
	const buttonStyles = [
		styles.button,
		styles[`${variant}Button`],
		styles[`${size}Button`],
		disabled && styles.disabledButton,
		selected && styles.selectedButton,
		fullWidth && styles.fullWidth,
		style,
	];

	const textStyles = [
		styles.text,
		styles[`${variant}Text`],
		styles[`${size}Text`],
		disabled && styles.disabledText,
		selected && styles[`${variant}SelectedText`],
		textStyle,
	];

	return (
		<TouchableOpacity
			style={buttonStyles}
			onPress={onPress}
			disabled={disabled || loading}
			activeOpacity={0.7}
		>
			{loading ? (
				<ActivityIndicator
					size="small"
					color={variant === "primary" ? "#fff" : "#2089dc"}
				/>
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
	primaryButton: {
		backgroundColor: "#2089dc",
		borderWidth: 0,
	},
	secondaryButton: {
		backgroundColor: "#e1e8ee",
		borderWidth: 0,
	},
	outlineButton: {
		backgroundColor: "transparent",
		borderWidth: 1,
		borderColor: "#2089dc",
	},
	textButton: {
		backgroundColor: "transparent",
		borderWidth: 0,
		paddingHorizontal: 0,
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
	disabledButton: {
		backgroundColor: "#e1e8ee",
		borderColor: "#c4c4c4",
	},
	selectedButton: {
		backgroundColor: "#e0e0e0",
		borderColor: "#2089dc",
	},
	fullWidth: {
		width: "100%",
	},
	text: {
		textAlign: "center",
		fontWeight: "500",
		fontSize: 16,
	},
	primaryText: {
		color: "#ffffff",
	},
	secondaryText: {
		color: "#1c1c1c",
	},
	outlineText: {
		color: "#2089dc",
	},
	textText: {
		color: "#2089dc",
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
	disabledText: {
		color: "#999999",
	},
	primarySelectedText: {
		color: "#ffffff",
	},
	secondarySelectedText: {
		color: "#1c1c1c",
	},
	outlineSelectedText: {
		color: "#2089dc",
	},
	textSelectedText: {
		color: "#2089dc",
		fontWeight: "bold",
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
	destructiveButton: {
		backgroundColor: "#f44336", // Red color
		borderWidth: 0,
	},
	destructiveText: {
		color: "#ffffff", // White text on red background
	},
	destructiveSelectedText: {
		color: "#ffffff",
		fontWeight: "bold",
	},
	disabledDestructiveButton: {
		backgroundColor: "#ffcdd2", // Lighter red when disabled
		opacity: 0.7,
	},
	disabledDestructiveText: {
		color: "#ffffff",
		opacity: 0.7,
	},
});
