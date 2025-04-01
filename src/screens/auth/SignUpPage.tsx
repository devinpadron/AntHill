import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormInput } from "../../components/ui/FormInput";
import { Button } from "../../components/ui/Button";
import { ToggleSwitch } from "../../components/ui/ToggleSwitch";
import { useSignUp } from "../../hooks/useSignUp";
import { AntHill } from "../../constants/colors";

const SignUpPage = ({ navigation }) => {
	const {
		firstName,
		setFirstName,
		lastName,
		setLastName,
		email,
		setEmail,
		password,
		setPassword,
		confPassword,
		setConfPassword,
		accessCode,
		setAccessCode,
		isLoading,
		isSolo,
		togglePersonalAccount,
		handleSignUp,
	} = useSignUp(navigation);

	return (
		<SafeAreaView style={styles.container}>
			<FormInput
				placeholder="First Name:"
				value={firstName}
				onChangeText={setFirstName}
			/>

			<FormInput
				placeholder="Last Name:"
				value={lastName}
				onChangeText={setLastName}
			/>

			<FormInput
				placeholder="Email:"
				value={email}
				onChangeText={setEmail}
				keyboardType="email-address"
			/>

			<FormInput
				placeholder="Password:"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>

			<FormInput
				placeholder="Confirm Password:"
				value={confPassword}
				onChangeText={setConfPassword}
				secureTextEntry
			/>

			{!isSolo && (
				<FormInput
					placeholder="Company Code:"
					value={accessCode}
					onChangeText={setAccessCode}
				/>
			)}

			<ToggleSwitch
				value={isSolo}
				onValueChange={togglePersonalAccount}
				label="Personal Account"
			/>

			<Button
				title="Sign Up"
				onPress={handleSignUp}
				loading={isLoading}
				style={styles.signUpButton}
				textStyle={styles.buttonText}
				variant="primary"
				fullWidth
			/>
		</SafeAreaView>
	);
};

export default SignUpPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		//justifyContent: "center",
		paddingHorizontal: 20,
		backgroundColor: "white",
	},
	signUpButton: {
		height: 48,
		marginTop: 20,
		borderRadius: 8,
		width: "100%",
		backgroundColor: AntHill.Black,
	},
	buttonText: {
		fontSize: 18,
		fontWeight: "600",
		color: AntHill.White,
	},
	backButton: {
		backgroundColor: "transparent",
		marginTop: 16,
	},
	backButtonText: {
		fontSize: 16,
		color: AntHill.Black,
		textDecorationLine: "underline",
	},
});
