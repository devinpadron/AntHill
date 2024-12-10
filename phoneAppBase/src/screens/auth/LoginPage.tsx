import React, { useState } from "react";
import {
	Text,
	Image,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert,
	Platform,
} from "react-native";
import {
	sendResetPassword,
	setUserData,
} from "../../controllers/auth/authController";
import prompt from "react-native-prompt-android";
import { SafeAreaView } from "react-native-safe-area-context";
import auth from "@react-native-firebase/auth";
import UserController from "../../controllers/data/userController";

const LoginPage = ({ navigation }: any) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const handleLogin = async () => {
		const userController = new UserController();
		const userCredential = await auth()
			.signInWithEmailAndPassword(email, password)
			.catch((error) => {
				switch (error.code) {
					case "auth/invalid-email":
						Alert.alert("Invalid email");
						break;
					case "auth/wrong-password":
						Alert.alert("Invalid password");
						break;
					case "auth/user-not-found":
						Alert.alert("User not found");
						break;
					case "auth/invalid-credential":
						Alert.alert("Invalid credentials");
						break;
					case "auth/too-many-requests":
						Alert.alert(
							"Too many attempts have been made",
							"Please try again later, or reset your password"
						);
						break;
					default:
						Alert.alert("Error logging in");
						console.error(error);
				}
				return;
			});
		if (userCredential) {
			const user = userCredential.user;
			const userData = await userController.getUser(user.uid);
			if (user.email != userData.email) {
				try {
					// update all instances of user data in every company
					await userController.updateUser(user.uid, {
						...userData,
						email: user.email,
					});
				} catch (error) {
					console.error("Error updating email in database:", error);
				}
			}
			console.log("User account signed in!");
		}
	};

	const pushSignup = () => {
		navigation.navigate("Sign Up");
	};

	const handleForgotPassword = async (text: string | undefined) => {
		if (!text) {
			console.log("Cancel");
			return;
		}
		sendResetPassword(text);
	};

	return (
		<SafeAreaView style={styles.container}>
			{/* Logo */}
			<Image
				style={styles.logoImage}
				source={require("../../assets/DolceNGelato/vicoLogoPrimary.png")}
			/>

			{/* Username Textbox */}
			<TextInput
				style={[styles.textInput, { marginTop: -20 }]}
				placeholder="Email:"
				onChangeText={setEmail}
				value={email}
				autoCapitalize="none"
				autoCorrect={false}
				keyboardType="email-address"
			/>

			<TextInput
				style={styles.textInput}
				placeholder="Password:"
				onChangeText={setPassword}
				secureTextEntry={true}
				value={password}
				autoCapitalize="none"
				autoCorrect={false}
			/>

			<TouchableOpacity
				style={[styles.roundButton, { height: 45, marginTop: 40 }]}
				onPress={handleLogin}
			>
				<Text style={[styles.buttonText, { color: "white" }]}>
					Login
				</Text>
			</TouchableOpacity>

			<TouchableOpacity
				style={[styles.roundButton, { height: 35 }]}
				onPress={pushSignup}
			>
				<Text style={[styles.buttonText, { color: "white" }]}>
					Signup
				</Text>
			</TouchableOpacity>

			<TouchableOpacity
				onPress={() => {
					if (Platform.OS == "android") {
						prompt(
							"Forgot Password",
							"Please enter your account email:",
							[
								{
									text: "Cancel",
									onPress: () => console.log("Cancel"),
									style: "cancel",
								},
								{
									text: "Submit",
									onPress: (text) =>
										handleForgotPassword(text),
								},
							],
							{
								type: "plain-text",
							}
						);
					}
					Alert.prompt(
						"Forgot Password",
						"Please enter your account email:",
						[
							{
								text: "Cancel",
								onPress: () => console.log("Cancel"),
								style: "cancel",
							},
							{
								text: "Submit",
								onPress: (text) => handleForgotPassword(text),
								isPreferred: true,
							},
						],
						"plain-text"
					);
				}}
			>
				<Text style={[{ color: "blue", marginTop: 15 }]}>
					Forgot Password
				</Text>
			</TouchableOpacity>
		</SafeAreaView>
	);
};

export default LoginPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "white",
		alignItems: "center",
	},
	textInput: {
		width: 350,
		height: 40,
		color: "black",
		margin: 10,
		padding: 5,
		fontSize: 16,
		borderColor: "rgba(211,211,211,0.5)",
		borderWidth: 1,
		borderRadius: 5,
	},
	logoImage: {
		width: 450,
		height: 300,
	},
	roundButton: {
		width: 350,
		margin: 5,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#1b2c3a",
		borderRadius: 20,
	},
	buttonText: {
		fontSize: 20,
	},
});
