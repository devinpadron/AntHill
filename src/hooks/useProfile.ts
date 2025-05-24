import { useState, useEffect } from "react";
import {
	subscribeCurrentUser,
	updateUser,
	swapUserCompany,
	deleteUser,
} from "../services/userService";
import {
	joinCompanyWithAccessCode,
	removeUserFromCompany,
} from "../services/companyService";
import { Alert } from "react-native";
import { showPrompt } from "../utils/alertUtils";
import auth from "@react-native-firebase/auth";
import { reAuth, sendResetPassword } from "../services/authService";
import { useUser } from "../contexts/UserContext";

export const useProfile = () => {
	const [isLoading, setIsLoading] = useState(true);

	const { user: userData, userId, isLoading: userLoading } = useUser();

	// Update user name
	const updateName = async (firstName: string, lastName: string) => {
		try {
			await updateUser(userId, {
				...userData,
				firstName,
				lastName,
			});
			Alert.alert("Success", "Your name has been updated successfully.");
		} catch (error) {
			console.error("Error updating name:", error);
			Alert.alert(
				"Error",
				"There was an error updating your name. Please try again.",
			);
		}
	};

	// Handle company change
	const handleCompanyChange = async (selectedCompany: string) => {
		await swapUserCompany(userId, selectedCompany);
	};

	// Join a company
	const joinCompany = async (accessCode: string) => {
		try {
			setIsLoading(true);
			const success = await joinCompanyWithAccessCode(
				userId,
				accessCode.trim(),
			);
			setIsLoading(false);

			if (success) {
				return success; // Return company ID for handling
			}
			return false;
		} catch (error) {
			setIsLoading(false);
			console.error("Error joining company:", error);
			return false;
		}
	};

	// Reauthenticate user
	const reauthenticate = () => {
		return new Promise((resolve, reject) => {
			const handleAuth = async (password: string) => {
				try {
					if (await reAuth(password)) {
						resolve(true);
					} else {
						reject("Authentication failed");
					}
				} catch (error) {
					reject(error);
				}
			};

			showPrompt(
				"Current Password",
				"Please enter your current password to continue:",
				[
					{
						text: "Cancel",
						style: "cancel",
						onPress: () => reject("Cancelled"),
					},
					{ text: "Continue", onPress: handleAuth },
				],
				{ isSecure: true },
			);
		});
	};

	// Update email
	const updateEmail = async (newEmail: string) => {
		const user = auth().currentUser;
		if (!user) return false;

		try {
			await user.verifyBeforeUpdateEmail(newEmail);
			return true;
		} catch (error) {
			switch (error.code) {
				case "auth/invalid-email":
					Alert.alert("The email address is invalid");
					break;
				case "auth/email-already-in-use":
					Alert.alert(
						"This email is already in use by another account",
					);
					break;
				case "auth/requires-recent-login":
					Alert.alert(
						"For security, please sign out and sign in again to change your email",
					);
					break;
				default:
					console.error("Email update error:", error);
			}
			return false;
		}
	};

	// Reset password
	const resetPassword = () => {
		if (userData?.email) {
			return sendResetPassword(userData.email);
		}
		return false;
	};

	// Delete account
	const deleteAccount = async () => {
		try {
			await removeUserFromCompany(userData.loggedInCompany, userId);
			return true;
		} catch (error) {
			console.error("Error deleting account:", error);
			return false;
		}
	};

	return {
		isLoading,
		userData,
		userId,
		updateName,
		handleCompanyChange,
		joinCompany,
		reauthenticate,
		updateEmail,
		resetPassword,
		deleteAccount,
	};
};
