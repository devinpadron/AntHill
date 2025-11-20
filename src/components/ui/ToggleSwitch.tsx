import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

type ToggleSwitchProps = {
	value: boolean;
	onValueChange: (value: boolean) => void;
	label: string;
};

export const ToggleSwitch = ({
	value,
	onValueChange,
	label,
}: ToggleSwitchProps) => {
	const { theme } = useTheme();

	return (
		<TouchableOpacity
			style={styles.toggleContainer}
			onPress={() => onValueChange(!value)}
		>
			<View
				style={[
					styles.toggle,
					{
						backgroundColor: value
							? theme.NotificationGreen
							: theme.DateBadge,
					},
				]}
			>
				<View
					style={[
						styles.toggleButton,
						value && styles.toggleButtonActive,
					]}
				/>
			</View>
			<Text style={[styles.toggleText, { color: theme.PrimaryText }]}>
				{label}
			</Text>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	toggleContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginVertical: 10,
		paddingHorizontal: 20,
	},
	toggle: {
		width: 50,
		height: 30,
		borderRadius: 15,
		padding: 2,
	},
	toggleButton: {
		width: 26,
		height: 26,
		borderRadius: 13,
		backgroundColor: "white",
	},
	toggleButtonActive: {
		transform: [{ translateX: 20 }],
	},
	toggleText: {
		marginLeft: 10,
		fontSize: 16,
	},
});
