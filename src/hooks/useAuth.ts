import { useState } from "react";
import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import { getUser, updateProfile } from "../services/userService";
import { sendResetPassword } from "../services/authService";

/*
 * Login, against the v2 schema.
 *
 * `authService` is shared with v1 unchanged — it only talks to Firebase Auth
 * and never touches Firestore, so there is nothing schema-specific in it.
 */
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

			/*
			 * Clear a stale unverified session first.
			 *
			 * Signing in as a uid that is ALREADY signed in is not an auth
			 * state change, so onAuthStateChanged does not fire and nothing
			 * navigates — the button appears dead until the app is relaunched.
			 * Signup now signs out on its way out, but it cannot if the app was
			 * killed between creating the account and finishing, so this
			 * guarantees the transition rather than assuming it.
			 *
			 * Only unverified sessions: a verified one signing in again is
			 * already in the state it wants.
			 */
			const stale = auth().currentUser;
			if (stale && !stale.emailVerified) {
				await auth()
					.signOut()
					.catch(() => {});
			}

			const userCredential = await auth().signInWithEmailAndPassword(
				email,
				password,
			);
			const user = userCredential.user;

			/*
			 * Keep the stored email in step with the Auth record, which is the
			 * source of truth for it.
			 *
			 * Guarded on the profile existing. v1 read `userData.email` off the
			 * result unconditionally and crashed on a null — the same
			 * unrecoverable loop that made leaving your last company brick the
			 * app, because v1 deleted the user document.
			 *
			 * updateProfile also fans the change out to the denormalized copies
			 * on this user's memberships, so a member list cannot go stale.
			 */
			const userData = await getUser(user.uid);
			if (userData && user.email && user.email !== userData.email) {
				await updateProfile(user.uid, { email: user.email });
			}

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
