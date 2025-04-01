import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

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
	return (
		<TouchableOpacity
			style={styles.toggleContainer}
			onPress={() => onValueChange(!value)}
		>
			<View style={[styles.toggle, value && styles.toggleActive]}>
				<View
					style={[
						styles.toggleButton,
						value && styles.toggleButtonActive,
					]}
				/>
			</View>
			<Text style={styles.toggleText}>{label}</Text>
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
		backgroundColor: "#e0e0e0",
		padding: 2,
	},
	toggleActive: {
		backgroundColor: "#4CAF50",
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
