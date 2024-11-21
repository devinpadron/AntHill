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
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import prompt from "react-native-prompt-android";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CompanyController from "../../controller/companyController";

const LoginPage = ({ navigation }: any) => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const companyController = new CompanyController();

	const handleLogin = async () => {
		await auth()
			.signInWithEmailAndPassword(email, password)
			.then(async (userCredential) => {
				const user = userCredential.user;
				await setUserData(user);
				console.log("User account signed in!");
			})
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
			});
	};

	const setUserData = async (user: FirebaseAuthTypes.User) => {
		if (user) {
			const data = await companyController.searchUserByEmail(user.email);
			if (data) {
				await AsyncStorage.setItem("userData", JSON.stringify(data));
			}
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
		await auth()
			.sendPasswordResetEmail(text)
			.then(() => {
				Alert.alert(
					"Please check your email to finish resetting your password"
				);
			})
			.catch((error) => {
				switch (error.code) {
					case "auth/user-not-found":
						Alert.alert("User not found");
						break;
					case "auth/invalid-email":
						Alert.alert("Invalid email");
						break;
					default:
						Alert.alert("Error sending request");
						console.error(error);
				}
			});
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
