import { Alert } from "react-native";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

/**
 * Signs in with email/password. Returns the credential so callers can read the
 * authenticated user. Throws on failure for the caller to map to UI.
 */
export async function signInWithEmail(
	email: string,
	password: string,
): Promise<FirebaseAuthTypes.UserCredential> {
	return auth().signInWithEmailAndPassword(email, password);
}

/**
 * Creates a new auth account and sets the display name. Returns the new user's
 * UID. Throws on failure for the caller to map to UI.
 */
export async function createAuthAccount(
	email: string,
	password: string,
	displayName: string,
): Promise<string> {
	const credential = await auth().createUserWithEmailAndPassword(
		email,
		password,
	);
	await credential.user.updateProfile({ displayName });
	return credential.user.uid;
}

/**
 * Sends a verification email to the currently signed-in user, if any.
 */
export async function sendVerificationEmail() {
	const user = auth().currentUser;
	if (user) {
		await user.sendEmailVerification();
	}
}

/**
 * Starts the verify-before-update flow for changing the signed-in user's email.
 * Returns false if no user is signed in. Throws on Firebase errors for the
 * caller to map to UI.
 */
export async function updateAuthEmail(newEmail: string): Promise<boolean> {
	const user = auth().currentUser;
	if (!user) {
		return false;
	}
	await user.verifyBeforeUpdateEmail(newEmail);
	return true;
}

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

export const signOut = async () => {
	try {
		await auth().signOut();
		// No need to clear AsyncStorage here since we'll handle it in the UserContext
	} catch (error) {
		console.error("Error signing out:", error);
		throw error;
	}
};

export async function sendResetPassword(email: string) {
	await auth()
		.sendPasswordResetEmail(email)
		.then(() => {
			Alert.alert(
				"Please check your email to finish resetting your password",
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

export async function deleteCurrentUser() {
	await auth().currentUser.delete();
}
