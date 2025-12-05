import React from "react";
import { Image, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { showPrompt } from "../../utils/alertUtils";
import { useAuth } from "../../hooks/useAuth";
import { FormInput } from "../../components/ui/FormInput";
import { Button } from "../../components/ui/Button";
import { Container } from "../../components/ui/Container";
import { Spacing, BorderRadius } from "../../constants/tokens";

const LoginPage = ({ navigation }) => {
	const { theme } = useTheme();
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
		<Container
			variant="page"
			padding="none"
			includeSafeArea
			style={styles.container}
		>
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
				secureTextEntry
			/>

			<Button
				title="Login"
				onPress={handleLogin}
				loading={loading}
				variant="primary"
				style={styles.primaryButton}
			/>

			<Button
				title="Signup"
				onPress={navigateToSignup}
				variant="secondary"
				style={styles.secondaryButton}
			/>

			<Button
				title="Forgot Password"
				onPress={handleForgotPassword}
				variant="text"
				style={styles.textButton}
			/>
		</Container>
	);
};

export default LoginPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: Spacing.lg,
	},
	logo: {
		width: 200,
		height: 150,
		resizeMode: "contain",
		marginBottom: Spacing.xxxl,
	},
	primaryButton: {
		marginTop: Spacing.xxxl,
		width: "100%",
	},
	secondaryButton: {
		marginTop: Spacing.md,
		width: "100%",
	},
	textButton: {
		marginTop: Spacing.xl,
	},
});
