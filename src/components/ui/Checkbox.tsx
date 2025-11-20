import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

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
	const { theme } = useTheme();

	return (
		<TouchableOpacity
			style={styles.checkboxRow}
			onPress={onPress}
			disabled={disabled}
		>
			<View
				style={[
					styles.checkbox,
					{
						borderColor: disabled
							? theme.TertiaryText
							: theme.SecondaryText,
					},
					checked && {
						backgroundColor: theme.LocationBlue,
						borderColor: theme.LocationBlue,
					},
					disabled && { backgroundColor: theme.DateBadge },
				]}
			>
				{checked && <Text style={styles.checkmark}>✓</Text>}
			</View>
			<Text
				style={[
					styles.checkboxLabel,
					{ color: theme.PrimaryText },
					disabled && { color: theme.TertiaryText },
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
		marginRight: 10,
		justifyContent: "center",
		alignItems: "center",
	},
	checkmark: {
		color: "white",
		fontSize: 14,
		fontWeight: "bold",
	},
	checkboxLabel: {
		fontSize: 15,
	},
});
