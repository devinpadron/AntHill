import React from "react";
import { TextInput, StyleSheet } from "react-native";
import { AntHill } from "../../constants/colors";

type FormInputProps = {
	placeholder: string;
	value: string;
	onChangeText: (text: string) => void;
	secureTextEntry?: boolean;
	keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
};

export const FormInput = ({
	placeholder,
	value,
	onChangeText,
	secureTextEntry = false,
	keyboardType = "default",
}: FormInputProps) => {
	return (
		<TextInput
			style={styles.textInput}
			placeholder={placeholder}
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
		width: 350,
		height: 40,
		color: AntHill.Black,
		margin: 10,
		padding: 5,
		fontSize: 16,
		borderColor: AntHill.Black,
		borderWidth: 1,
		borderRadius: 5,
	},
});
