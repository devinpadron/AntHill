import { useEffect, useState } from "react";
import { Alert } from "react-native";
import auth from "@react-native-firebase/auth";
import { showPrompt } from "../../utils/alertUtils";
import { reAuth, sendResetPassword } from "../../services/authService";
import { useUser } from "../../contexts/v2/UserContext";
import { setActiveCompany, updateProfile } from "../../services/v2/userService";
import {
	getMembershipsForUser,
	joinCompanyWithAccessCode,
	removeMember,
} from "../../services/v2/membershipService";

export const useProfile = () => {
	const [isLoading, setIsLoading] = useState(false);

	/*
	 * The companies this user belongs to.
	 *
	 * v1 read `user.companies[]` — an array kept in sync with the membership
	 * documents by two non-atomic writes, which is the orphan class the audit
	 * found. Memberships are the only source now, and they carry the company
	 * NAME, so the switcher can show something readable instead of a raw id.
	 */
	const [memberships, setMemberships] = useState<
		{ companyId: string; label: string }[]
	>([]);

	const {
		user: userData,
		userId,
		isLoading: userLoading,
		companyId,
	} = useUser();

	useEffect(() => {
		if (!userId) return;
		let cancelled = false;

		getMembershipsForUser(userId).then((rows) => {
			if (cancelled) return;
			setMemberships(
				rows.map((m) => ({
					companyId: m.companyId,
					label: m.companyId,
				})),
			);
		});

		return () => {
			cancelled = true;
		};
	}, [userId, companyId]);

	// Update user name
	const updateName = async (firstName: string, lastName: string) => {
		try {
			/*
			 * A patch. v1 spread the whole user document back, and separately
			 * had to keep membership copies in sync by hand — updateProfile
			 * does both in one place now.
			 */
			await updateProfile(userId, { firstName, lastName });
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
		await setActiveCompany(userId, selectedCompany);
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

			// The service returns { companyId } or null; callers want the id.
			return success ? success.companyId : false;
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

	/*
	 * Leaves the active company.
	 *
	 * v1 deleted the USER DOCUMENT when this was their last company, while
	 * leaving the Auth account behind — so the next sign-in read `.email` off
	 * null and crashed, unrecoverably. removeMember marks the membership
	 * removed and clears the active company; the profile survives.
	 */
	const leaveCompany = async () => {
		if (!companyId) return false;
		try {
			await removeMember(companyId, userId);
			return true;
		} catch (error) {
			console.error("Error leaving company:", error);
			return false;
		}
	};

	/*
	 * ONE write. v1 wrote this field three times: directly to the user
	 * document, again to a dead Companies/{c}/Employees record, and once more
	 * through updateUser.
	 */
	const updatePhone = async (phone: string): Promise<boolean> => {
		if (!userId) return false;
		try {
			await updateProfile(userId, { phone });
			return true;
		} catch (error) {
			console.error("Error updating phone:", error);
			return false;
		}
	};

	return {
		isLoading,
		userData,
		userId,
		memberships,
		updateName,
		handleCompanyChange,
		joinCompany,
		reauthenticate,
		updateEmail,
		resetPassword,
		leaveCompany,
		updatePhone,
	};
};
