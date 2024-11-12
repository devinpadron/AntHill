import React, { useState } from "react";
import {
	View,
	TextInput,
	TouchableOpacity,
	Text,
	StyleSheet,
	Alert,
} from "react-native";
import UserController from "../../controller/userController";
import CompanyController from "../../controller/companyController";
import auth from "@react-native-firebase/auth";

const SignUpPage = ({ navigation }: any) => {
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confPassword, setConfPassword] = useState("");
	const [accessCode, setAccessCode] = useState("");
	const companyController = new CompanyController();

	const validateFields = () => {
		if (!firstName.trim()) {
			return "First name is required.";
		}
		if (!lastName.trim()) {
			return "Last name is required.";
		}
		if (!email.trim()) {
			return "Email is required.";
		}
		if (!/\S+@\S+\.\S+/.test(email)) {
			return "Email is invalid.";
		}
		if (!password) {
			return "Password is required.";
		}
		if (password.length < 6) {
			return "Password must be at least 6 characters long.";
		}
		if (password !== confPassword) {
			return "Passwords do not match.";
		}
		// Add any other validation rules here (e.g., for accessCode if it's required)
		return null; // No errors
	};

	const handleSignUp = async () => {
		const foundCompany = await companyController.compareAccessCode(
			accessCode
		);
		if (foundCompany == "") {
			Alert.alert("Invalid Access Code");
			return;
		}
		const userController = new UserController(foundCompany);

		const userData = {
			firstName: firstName,
			lastName: lastName,
			email: email,
			privilege: "User",
		};
		await auth()
			.createUserWithEmailAndPassword(email, password)
			.then((userCredential) => {
				const user = userCredential.user;
				user.updateProfile({ displayName: firstName + " " + lastName });
				userController.addUser(userData, user.uid);
				console.log("User account created & signed in!");
			})
			.catch((error) => {
				switch (error.code) {
					case "auth/email-already-in-use":
						Alert.alert("That email address is already in use!");
						break;
					case "auth/invalid-email":
						Alert.alert("That email address is invalid!");
						break;
					case "auth/weak-password":
						Alert.alert(
							"Weak password",
							"You must include atleast:\n8 characters\n1 uppercase character\n1 lowercase character\n1 number\n1 special character"
						);
						break;
					case "auth/password-does":
						Alert.alert(
							"Weak password",
							"You must include atleast:\n\n8 characters\n1 uppercase character\n1 lowercase character\n1 number\n1 special character"
						);
						break;
					default:
						Alert.alert("Signup error", error.message);
						console.log(error.code);
				}
			});
	};

	return (
		<View style={styles.container}>
			<TextInput
				style={styles.textInput}
				placeholder="First Name:"
				onChangeText={setFirstName}
				value={firstName}
				autoCorrect={false}
			/>
			<TextInput
				style={styles.textInput}
				placeholder="Last Name:"
				onChangeText={setLastName}
				value={lastName}
				autoCorrect={false}
			/>
			<TextInput
				style={styles.textInput}
				placeholder="Email:"
				onChangeText={setEmail}
				value={email}
				autoCorrect={false}
				autoCapitalize="none"
				keyboardType="email-address"
			/>
			<TextInput
				style={styles.textInput}
				placeholder="Password:"
				onChangeText={setPassword}
				value={password}
				autoCorrect={false}
				autoCapitalize="none"
				secureTextEntry={true}
			/>
			<TextInput
				style={styles.textInput}
				placeholder="Confirm Password:"
				onChangeText={setConfPassword}
				value={confPassword}
				autoCorrect={false}
				autoCapitalize="none"
				secureTextEntry={true}
			/>
			<TextInput
				style={styles.textInput}
				placeholder="Company Code:"
				onChangeText={setAccessCode}
				value={accessCode}
				autoCapitalize="none"
				autoCorrect={false}
			/>
			<TouchableOpacity style={styles.roundButton} onPress={handleSignUp}>
				<Text style={{ color: "white" }}>Sign Up</Text>
			</TouchableOpacity>
		</View>
	);
};

export default SignUpPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: 50,
		//justifyContent: "center",
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
		width: 350,
		height: 200,
		marginTop: 100,
		marginBottom: -25,
	},
	roundButton: {
		width: 350,
		margin: 15,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#1b2c3a",
		borderRadius: 20,
		height: 30,
	},
});
