import { useState } from "react";
import { addUser } from "../../services/userService";
import {
	createAuthAccount,
	sendVerificationEmail,
} from "../../services/authService";
import {
	addUserToCompany,
	compareAccessCode,
} from "../../services/companyService";
import {
	validateSignupFields,
	formatUserData,
	handleAuthError,
} from "../../utils/authUtils";
import { Alert } from "react-native";
import { capitalize } from "lodash";
import { Role } from "../../types";

export const useSignUp = (navigation: any) => {
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confPassword, setConfPassword] = useState("");
	const [accessCode, setAccessCode] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSignUp = async () => {
		// Validate all fields
		if (
			!validateSignupFields(
				firstName,
				lastName,
				email,
				password,
				confPassword,
				accessCode,
			)
		) {
			return;
		}

		// Check company code
		let company = "";
		company = await compareAccessCode(accessCode);
		if (!company) {
			Alert.alert("Invalid Access Code");
			return;
		}

		setIsLoading(true);

		try {
			// Create user account and set the display name
			const uid = await createAuthAccount(
				email,
				password,
				`${capitalize(firstName)} ${capitalize(lastName)}`,
			);

			// Prepare user data based on account type
			const companyId = company;
			const role = Role.USER;
			const userData = formatUserData(
				firstName,
				lastName,
				email,
				companyId,
				uid,
			);

			// Save user data
			await addUser(userData, uid);
			await addUserToCompany(companyId, uid, role);

			// Send verification email
			await sendVerificationEmail();
			console.log("User account created & signed in!");

			// Navigate back
			navigation.pop();
		} catch (error) {
			handleAuthError(error);
		} finally {
			setIsLoading(false);
		}
	};

	return {
		firstName,
		setFirstName,
		lastName,
		setLastName,
		email,
		setEmail,
		password,
		setPassword,
		confPassword,
		setConfPassword,
		accessCode,
		setAccessCode,
		isLoading,
		handleSignUp,
	};
};
