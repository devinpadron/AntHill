import { useState } from "react";
import auth from "@react-native-firebase/auth";
import { addUser } from "../services/userService";
import {
	addUserToCompany,
	compareAccessCode,
} from "../services/companyService";
import {
	validateSignupFields,
	formatUserData,
	handleAuthError,
} from "../utils/authUtils";
import { Alert } from "react-native";
import { capitalize } from "lodash";
import { Role } from "../types";

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

		setIsLoading(true);

		try {
			// Create the account BEFORE looking up the access code. Reading the
			// Companies collection requires authentication, so this order is
			// load-bearing — see firestore.rules.
			const userCredential = await auth().createUserWithEmailAndPassword(
				email,
				password,
			);
			const user = userCredential.user;

			// Check company code
			const company = await compareAccessCode(accessCode);
			if (!company) {
				// Roll the account back so an invalid code doesn't strand a
				// half-created user with no profile document.
				try {
					await user.delete();
				} catch (deleteError) {
					console.error(
						"Failed to roll back account after invalid access code",
						deleteError,
					);
				}
				Alert.alert("Invalid Access Code");
				return;
			}

			// Update display name
			await user.updateProfile({
				displayName: `${capitalize(firstName)} ${capitalize(lastName)}`,
			});

			// Prepare user data based on account type
			const companyId = company;
			const role = Role.USER;
			const userData = formatUserData(
				firstName,
				lastName,
				email,
				companyId,
				user.uid,
			);

			// Save user data
			await addUser(userData, user.uid);
			await addUserToCompany(companyId, user.uid, role);

			// Send verification email
			await user.sendEmailVerification();
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
