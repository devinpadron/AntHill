import { Alert } from "react-native";
import { capitalize, lowerCase } from "lodash";

export const validateSignupFields = (
	firstName: string,
	lastName: string,
	email: string,
	password: string,
	confirmPassword: string,
	accessCode: string,
) => {
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
	if (password !== confirmPassword) {
		Alert.alert("Passwords do not match.");
		return false;
	}

	// Strong password validation
	const passwordRegex = new RegExp(
		"^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$",
	);
	if (!passwordRegex.test(password)) {
		Alert.alert(
			"Weak password",
			"Your password must include at least:\n\n8 characters\n1 uppercase character\n1 lowercase character\n1 number\n1 special character",
		);
		return false;
	}

	// Access code is required
	if (!accessCode.trim()) {
		Alert.alert("Company code is required.");
		return false;
	}

	return true;
};

export const formatUserData = (
	firstName: string,
	lastName: string,
	email: string,
	companyId: string,
	userId: string,
) => {
	return {
		firstName: capitalize(firstName),
		lastName: capitalize(lastName),
		email: lowerCase(email),
		loggedInCompany: companyId,
		companies: [companyId],
		id: userId,
	};
};

export const handleAuthError = (error: any) => {
	switch (error.code) {
		case "auth/email-already-in-use":
			Alert.alert("That email address is already in use!");
			break;
		case "auth/invalid-email":
			Alert.alert("That email address is invalid!");
			break;
		default:
			Alert.alert("Error", error.message);
			console.error(error);
	}
};
