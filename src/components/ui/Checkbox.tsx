import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type CheckboxProps = {
	checked: boolean;
	onPress: () => void;
	label: string;
	disabled?: boolean;
};

export const Checkbox: React.FC<CheckboxProps> = ({
	checked,
	onPress,
	label,
	disabled = false,
}) => {
	return (
		<TouchableOpacity
			style={styles.checkboxRow}
			onPress={onPress}
			disabled={disabled}
		>
			<View
				style={[
					styles.checkbox,
					checked && styles.checkboxSelected,
					disabled && styles.checkboxDisabled,
				]}
			>
				{checked && <Text style={styles.checkmark}>✓</Text>}
			</View>
			<Text
				style={[
					styles.checkboxLabel,
					disabled && styles.checkboxLabelDisabled,
				]}
			>
				{label}
			</Text>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	checkboxRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 10,
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 4,
		borderWidth: 1,
		borderColor: "#ccc",
		marginRight: 10,
		justifyContent: "center",
		alignItems: "center",
	},
	checkboxSelected: {
		backgroundColor: "#2089dc",
		borderColor: "#2089dc",
	},
	checkboxDisabled: {
		backgroundColor: "#f0f0f0",
		borderColor: "#e0e0e0",
	},
	checkmark: {
		color: "white",
		fontSize: 14,
		fontWeight: "bold",
	},
	checkboxLabel: {
		fontSize: 15,
	},
	checkboxLabelDisabled: {
		color: "#999",
	},
});
