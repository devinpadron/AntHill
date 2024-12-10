import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import UserController from "../data/userController";

export async function reAuth(password: string) {
	const user = auth().currentUser;
	if (!user?.email) {
		Alert.alert("Error", "No user is currently signed in");
		return;
	}

	// Reauthenticate with current credentials
	const credential = auth.EmailAuthProvider.credential(user.email, password);
	await user.reauthenticateWithCredential(credential).catch((error) => {
		switch (error.code) {
			case "auth/wrong-password":
				Alert.alert("Error", "Incorrect password. Please try again.");
				break;
			case "auth/invalid-credential":
				Alert.alert("Error", "Invalid credentials. Please try again.");
				break;
			default:
				console.error("Reauthentication error:", error);
		}
		return false;
	});
	return true;
}

export async function signOut() {
	await AsyncStorage.removeItem("userData");
	await auth().signOut();
	return true;
}

export async function sendResetPassword(email: string) {
	await auth()
		.sendPasswordResetEmail(email)
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
	return true;
}

export async function setUserData(id: string) {
	const userController = new UserController();
	const data = await userController.getUser(id);
	if (data) {
		await AsyncStorage.setItem("userData", JSON.stringify(data));
		return true;
	}
	return false;
}

export async function getUserData() {
	const userData = await AsyncStorage.getItem("userData");
	return JSON.parse(userData || null);
}

export async function deleteCurrentUser() {
	await auth().currentUser.delete();
	await AsyncStorage.removeItem("userData");
}
