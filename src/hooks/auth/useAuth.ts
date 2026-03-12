import { useState } from "react";
import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import { getUser, updateUser } from "../../services/userService";
import { sendResetPassword } from "../../services/authService";

export const useAuth = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const handleAuthError = (error: any) => {
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
					"Please try again later, or reset your password",
				);
				break;
			default:
				Alert.alert("Error logging in");
				console.error(error);
		}
	};

	const login = async () => {
		try {
			setLoading(true);
			const userCredential = await auth().signInWithEmailAndPassword(
				email,
				password,
			);

			// If login successful, sync email in database
			const user = userCredential.user;
			const userData = await getUser(user.uid);
			if (user.email !== userData.email) {
				await updateUser(user.uid, {
					...userData,
					email: user.email,
				});
			}

			console.log("User account signed in!");
			return true;
		} catch (error) {
			handleAuthError(error);
			return false;
		} finally {
			setLoading(false);
		}
	};

	const resetPassword = async (resetEmail: string) => {
		try {
			await sendResetPassword(resetEmail);
			Alert.alert(
				"Reset Email Sent",
				"Check your email for password reset instructions.",
			);
			return true;
		} catch (error) {
			Alert.alert(
				"Error",
				"Could not send reset email. Please try again.",
			);
			console.error(error);
			return false;
		}
	};

	return {
		email,
		setEmail,
		password,
		setPassword,
		loading,
		login,
		resetPassword,
	};
};
