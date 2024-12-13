import React, { useState } from "react";
import {
	TextInput,
	TouchableOpacity,
	Text,
	StyleSheet,
	Alert,
	ActivityIndicator,
} from "react-native";
import auth from "@react-native-firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";
import { capitalize, lowerCase } from "lodash";
import { addUser } from "../../controllers/userController";
import {
	addUserToCompany,
	compareAccessCode,
} from "../../controllers/companyController";

const SignUpPage = ({ navigation }: any) => {
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confPassword, setConfPassword] = useState("");
	const [accessCode, setAccessCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const validateFields = () => {
		if (!firstName.trim()) {
			Alert.alert("First name is required.");
			return false;
		}
		if (!lastName.trim()) {
			Alert.alert("Last name is required.");
			return false;
		}
		if (!email.trim()) {
			Alert.alert("Email is required.");
			return false;
		}
		if (!password) {
			Alert.alert("Password is required.");
			return false;
		}
		if (password !== confPassword) {
			Alert.alert("Passwords do not match.");
			return false;
		}

		// Password must be 8 characters long, include atleast 1 uppercase char, 1 lowercase char, 1 number, and 1 special char.
		// The reason for the tight restrictions is due to the amount of personal data being saved, and how this is tied directly to their job.
		const regexp = new RegExp(
			"^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$"
		);
		if (regexp.test(password) == false) {
			Alert.alert(
				"Weak password",
				"Your password must include atleast:\n\n8 characters\n1 uppercase character\n1 lowercase character\n1 number\n1 special character"
			);
			return false;
		}
		// Add any other validation rules here (e.g., for accessCode if it's required)
		return true; // No errors
	};

	const handleSignUp = async () => {
		if (!validateFields()) {
			return;
		}
		const company = await compareAccessCode(accessCode);
		if (company == "" || company == null) {
			Alert.alert("Invalid Access Code");
			return;
		}
		setIsLoading(true);
		await auth()
			.createUserWithEmailAndPassword(email, password)
			.then(async (userCredential) => {
				const user = userCredential.user;
				await user.updateProfile({
					displayName:
						capitalize(firstName) + " " + capitalize(lastName),
				});
				const userData = {
					firstName: capitalize(firstName),
					lastName: capitalize(lastName),
					email: lowerCase(email),
					loggedInCompany: company,
					companies: { [company]: "User" },
				};
				await addUser(userData, user.uid);
				await addUserToCompany(company, user.uid);
				await user.sendEmailVerification();
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
					default:
						Alert.alert("Error during sign up, please try again");
						console.error(error);
				}
			});
		navigation.pop();
		setIsLoading(false);
	};

	return (
		<SafeAreaView style={styles.container}>
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
			{isLoading ? (
				<ActivityIndicator size="small" color="#0000ff" />
			) : null}
		</SafeAreaView>
	);
};

export default SignUpPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
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
