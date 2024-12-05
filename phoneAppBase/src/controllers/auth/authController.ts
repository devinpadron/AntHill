import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import UserController from "../data/userController";

export const currentUser = auth().currentUser;

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
	});
}

export async function changeEmail(newEmail: string) {
	const userData = JSON.parse(await AsyncStorage.getItem("userData"));
	const user = auth().currentUser;
	if (!user) {
		return;
	}
	// send email to update
	await user.updateEmail(newEmail).catch((error) => {
		switch (error.code) {
			case "auth/invalid-email":
				Alert.alert("The email address is invalid");
				break;
			case "auth/email-already-in-use":
				Alert.alert("This email is already in use by another account");
				break;
			case "auth/requires-recent-login":
				Alert.alert(
					"For security, please sign out and sign in again to change your email"
				);
				break;
			default:
				console.error("Email update error:", error);
		}
	});
	await user.sendEmailVerification();
	try {
		const userController = new UserController();

		// update all instances of user data in every company
		userController.updateUser(userData.id, {
			...userData,
			email: newEmail,
		});
	} catch (error) {
		console.error("Error updating email in database:", error);
	}
	Alert.alert(
		"Verification Email Sent",
		"Please check your new email address and verify the change. For security purposes, please login again.",
		[
			{
				text: "Logout",
				style: "default",
				onPress: async () => signOut(),
			},
		]
	);
}

export async function signOut() {
	await AsyncStorage.removeItem("userData");
	await auth().signOut();
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
}

export async function deleteCurrentUser() {
	await auth().currentUser.delete();
	await AsyncStorage.removeItem("userData");
}

export async function login(email: string, password: string) {
	await auth()
		.signInWithEmailAndPassword(email, password)
		.then(async (userCredential) => {
			const user = userCredential.user;
			await setUserData(user.uid);
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
}

export async function setUserData(id: string) {
	const userController = new UserController();
	const data = await userController.getUser(id);
	if (data) {
		await AsyncStorage.setItem("userData", JSON.stringify(data));
	}
}

export async function signUp(
	email: string,
	firstName: string,
	lastName: string,
	password: string,
	company: string
) {
	const userController = new UserController();
	await auth()
		.createUserWithEmailAndPassword(email, password)
		.then(async (userCredential) => {
			const user = userCredential.user;
			user.updateProfile({ displayName: firstName + " " + lastName });
			const userData = {
				id: user.uid,
				firstName: firstName,
				lastName: lastName,
				email: email,
				privilege: "User",
				selectedCompany: company,
				companies: [company],
			};
			await userController.addUser(userData, user.uid);
			await user.sendEmailVerification();
			//Alert.alert("Check your email to complete verification!");
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
					Alert.alert("Error logging in");
					console.error(error);
			}
		});
}
