import React from "react";
import { TextInput, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius } from "../../constants/tokens";

type FormInputProps = {
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
	secureTextEntry?: boolean;
	keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
	style?: ViewStyle;
};

export const FormInput = ({
	placeholder,
	value,
	onChangeText,
	secureTextEntry = false,
	keyboardType = "default",
	style,
}: FormInputProps) => {
	const { theme } = useTheme();

	const inputStyles = [
		styles.textInput,
		{
			color: theme.PrimaryText,
			borderColor: theme.BorderColor || theme.SecondaryText,
			backgroundColor: theme.CardBackground,
			placeholderTextColor: theme.TertiaryText,
		},
		style,
	];

	return (
		<TextInput
			style={inputStyles}
			placeholder={placeholder}
			placeholderTextColor={theme.TertiaryText}
			onChangeText={onChangeText}
			value={value}
			secureTextEntry={secureTextEntry}
			autoCapitalize="none"
			autoCorrect={false}
			keyboardType={keyboardType}
		/>
	);
};

const styles = StyleSheet.create({
	textInput: {
		width: "100%",
		height: 48,
		marginVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		fontSize: 16,
		borderWidth: 1,
		borderRadius: BorderRadius.md,
	},
});
