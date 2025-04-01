import React from "react";
import { Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AntHill } from "../../constants/colors";
import { showPrompt } from "../../utils/alertUtils";
import { useAuth } from "../../hooks/useAuth";
import { FormInput } from "../../components/ui/FormInput";
import { Button } from "../../components/ui/Button";

const LoginPage = ({ navigation }) => {
	const {
		email,
		setEmail,
		password,
		setPassword,
		loading,
		login,
		resetPassword,
	} = useAuth();

	const handleLogin = async () => {
		const success = await login();
		// Login success is handled by UserContext navigation
	};

	const navigateToSignup = () => {
		navigation.navigate("Sign Up");
	};

	const handleForgotPassword = () => {
		const defaultEmail = email || "";
		showPrompt(
			"Forgot Password",
			"Please enter your account email:",
			[
				{
					text: "Cancel",
					onPress: () => console.log("Reset password cancelled"),
					style: "cancel",
				},
				{
					text: "Submit",
					onPress: (resetEmail) => {
						if (resetEmail && resetEmail.trim()) {
							resetPassword(resetEmail.trim());
						}
					},
				},
			],
			{ defaultValue: defaultEmail },
		);
	};

	return (
		<SafeAreaView style={styles.container}>
			{/* Logo */}
			<Image
				style={styles.logo}
				source={require("../../assets/AntHill/Full_Black.png")}
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
				secureTextEntry={true}
			/>

			<Button
				title="Login"
				onPress={handleLogin}
				loading={loading}
				style={styles.primaryButton}
				textStyle={styles.buttonText}
				variant="primary"
				fullWidth
			/>

			<Button
				title="Signup"
				onPress={navigateToSignup}
				style={styles.secondaryButton}
				textStyle={styles.buttonText}
				variant="secondary"
			/>

			<Button
				title="Forgot Password"
				onPress={handleForgotPassword}
				style={styles.textButton}
				textStyle={styles.linkText}
				variant="text"
			/>
		</SafeAreaView>
	);
};

export default LoginPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "white",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 20, // Add padding to prevent buttons stretching too wide
	},
	logo: {
		width: 200,
		height: 150,
		resizeMode: "contain",
		marginBottom: 40,
	},
	primaryButton: {
		height: 48,
		marginTop: 40,
		borderRadius: 8,
		width: "100%",
		backgroundColor: AntHill.Black,
	},
	secondaryButton: {
		height: 48,
		marginTop: 16,
		borderRadius: 8,
		width: "100%",
		backgroundColor: AntHill.Black,
	},
	textButton: {
		backgroundColor: "transparent",
		marginTop: 20,
		height: 40,
	},
	buttonText: {
		fontSize: 18,
		fontWeight: "600",
		color: AntHill.White,
	},
	linkText: {
		fontSize: 16,
		color: AntHill.Black,
		textDecorationLine: "underline",
	},
});
