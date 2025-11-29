import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";

interface InfoRowProps {
	label: string;
	value: string | React.ReactNode;
	icon?: keyof typeof Ionicons.glyphMap;
	iconColor?: string;
	labelWidth?: number;
	style?: ViewStyle;
	labelStyle?: TextStyle;
	valueStyle?: TextStyle;
}

export const InfoRow: React.FC<InfoRowProps> = ({
	label,
	value,
	icon,
	iconColor,
	labelWidth = 80,
	style,
	labelStyle,
	valueStyle,
}) => {
	const { theme } = useTheme();

	return (
		<View style={[styles.row, style]}>
			{icon && (
				<Ionicons
					name={icon}
					size={16}
					color={iconColor || theme.SecondaryText}
					style={styles.icon}
				/>
			)}
			<Text
				style={[
					styles.label,
					{ width: labelWidth, color: theme.SecondaryText },
					labelStyle,
				]}
			>
				{label}
			</Text>
			{typeof value === "string" ? (
				<Text
					style={[
						styles.value,
						{ color: theme.PrimaryText },
						valueStyle,
					]}
				>
					{value}
				</Text>
			) : (
				<View style={styles.valueContainer}>{value}</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	icon: {
		marginRight: 6,
	},
	label: {
		fontSize: 15,
	},
	value: {
		fontSize: 15,
		flex: 1,
	},
	valueContainer: {
		flex: 1,
	},
});
