/**
 * Auth validation and error mapping.
 *
 * These used to raise `Alert.alert` themselves, which meant a single empty
 * field became a modal the user had to dismiss before they could see which
 * field it was. They return errors now, and the screens render them under the
 * offending input.
 */

/** Which field an error belongs under. `form` is a message for the whole page. */
export type SignupField =
	| "firstName"
	| "lastName"
	| "email"
	| "password"
	| "confPassword"
	| "accessCode"
	| "form";

export type LoginField = "email" | "password" | "form";

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

/*
 * At least 8 characters, with an upper, a lower, a digit and a symbol.
 * Unchanged from the previous rule — only how it is reported changed.
 */
const STRONG_PASSWORD =
	/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/;

/**
 * Validates the signup form.
 *
 * Returns every problem at once rather than stopping at the first, so the user
 * fixes the form in one pass instead of discovering the next requirement after
 * each attempt.
 */
export const validateSignupFields = (fields: {
	firstName: string;
	lastName: string;
	email: string;
	password: string;
	confPassword: string;
	accessCode: string;
}): FieldErrors<SignupField> => {
	const errors: FieldErrors<SignupField> = {};

	if (!fields.firstName.trim()) errors.firstName = "Required.";
	if (!fields.lastName.trim()) errors.lastName = "Required.";
	if (!fields.email.trim()) errors.email = "Required.";

	if (!fields.password) {
		errors.password = "Required.";
	} else if (!STRONG_PASSWORD.test(fields.password)) {
		errors.password =
			"Use at least 8 characters, with an uppercase and a lowercase letter, a number and a symbol.";
	}

	if (fields.password && fields.confPassword !== fields.password) {
		errors.confPassword = "Passwords do not match.";
	}

	if (!fields.accessCode.trim()) {
		errors.accessCode = "Ask whoever invited you for your code.";
	}

	return errors;
};

/** Maps a Firebase Auth error onto the field it belongs to. */
export const mapSignupError = (error: any): FieldErrors<SignupField> => {
	switch (error?.code) {
		case "auth/email-already-in-use":
			return { email: "That email already has an account." };
		case "auth/invalid-email":
			return { email: "That does not look like an email address." };
		case "auth/weak-password":
			return { password: "That password is too weak." };
		case "auth/network-request-failed":
			return { form: "No connection. Check your network and try again." };
		default:
			console.error(error);
			return {
				form:
					error?.message ?? "Something went wrong. Please try again.",
			};
	}
};

/** The same, for the login form. */
export const mapLoginError = (error: any): FieldErrors<LoginField> => {
	switch (error?.code) {
		case "auth/invalid-email":
			return { email: "That does not look like an email address." };
		case "auth/user-not-found":
			return { email: "No account with that email." };
		case "auth/wrong-password":
			return { password: "Incorrect password." };
		/*
		 * Firebase collapses a wrong email and a wrong password into this one
		 * code, so it deliberately does not blame a specific field.
		 */
		case "auth/invalid-credential":
			return { form: "That email and password do not match." };
		case "auth/too-many-requests":
			return {
				form: "Too many attempts. Try again later, or reset your password.",
			};
		case "auth/network-request-failed":
			return { form: "No connection. Check your network and try again." };
		default:
			console.error(error);
			return { form: "Could not sign in. Please try again." };
	}
};
