import { Alert } from "react-native";
import { supabase } from "../../lib/supabase";

/**
 * Supabase implementation of authService — SHADOW MODULE.
 *
 * Mirrors the exported signatures of src/services/authService.ts (the Firebase
 * version) so the cutover is an import swap. NOT wired into the app yet; see
 * supabase/ADAPTER.md for the atomic-cutover plan.
 *
 * Behavioral notes for the cutover:
 *   - Supabase auth errors carry `error.message`/`error.status`, not Firebase
 *     `error.code`. useAuth/useSignUp error mapping must be updated to match.
 *   - Email confirmation is sent automatically by signUp; there is no separate
 *     "send verification" call (we expose a resend for parity).
 */

/** Sign in; returns a Firebase-credential-shaped object so callers are unchanged. */
export async function signInWithEmail(email: string, password: string) {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw error;
	return { user: { uid: data.user.id, email: data.user.email } };
}

/** Create an account, seeding first/last name metadata for the profile trigger. */
export async function createAuthAccount(
	email: string,
	password: string,
	displayName: string,
): Promise<string> {
	const [firstName, ...rest] = displayName.trim().split(/\s+/);
	const lastName = rest.join(" ");
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: { data: { first_name: firstName ?? "", last_name: lastName } },
	});
	if (error) throw error;
	// data.user is null only when email confirmation is required AND the project
	// is configured to not return a user; in our flow it is returned.
	return data.user?.id ?? "";
}

/** Resend the signup confirmation email to the current user (parity shim). */
export async function sendVerificationEmail() {
	const { data } = await supabase.auth.getUser();
	const email = data.user?.email;
	if (email) {
		await supabase.auth.resend({ type: "signup", email });
	}
}

/** Start the verify-before-update flow for the signed-in user's email. */
export async function updateAuthEmail(newEmail: string): Promise<boolean> {
	const { error } = await supabase.auth.updateUser({ email: newEmail });
	if (error) throw error;
	return true;
}

/** Re-authenticate by re-signing-in with the current email + supplied password. */
export async function reAuth(password: string) {
	const { data } = await supabase.auth.getUser();
	const email = data.user?.email;
	if (!email) {
		Alert.alert("Error", "No user is currently signed in");
		return false;
	}
	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) {
		Alert.alert("Error", "Incorrect password. Please try again.");
		return false;
	}
	return true;
}

export const signOut = async () => {
	const { error } = await supabase.auth.signOut();
	if (error) {
		console.error("Error signing out:", error);
		throw error;
	}
};

export async function sendResetPassword(email: string) {
	const { error } = await supabase.auth.resetPasswordForEmail(email);
	if (error) {
		Alert.alert("Error sending request");
		console.error(error);
		return false;
	}
	Alert.alert("Please check your email to finish resetting your password");
	return true;
}

/**
 * Deleting one's own auth user requires elevated privileges. Exposed as an RPC
 * (`delete_own_account`, security definer + admin API in an edge function) —
 * add it before cutover; this calls it.
 */
export async function deleteCurrentUser() {
	const { error } = await supabase.rpc("delete_own_account");
	if (error) throw error;
}
