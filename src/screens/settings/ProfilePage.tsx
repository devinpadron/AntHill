import React from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LoadingScreen from "../LoadingScreen";
import { signOut } from "../../services/authService";
import { useProfile } from "../../hooks/useProfile";
import { ProfileHeader } from "../../components/profile/ProfileHeader";
import { showPrompt, showConfirmation } from "../../utils/alertUtils";
import { Button } from "../../components/ui/Button";

const ProfilePage = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const {
		isLoading,
		userData,
		isSolo,
		updateName,
		handleCompanyChange,
		joinCompany,
		reauthenticate,
		updateEmail,
		resetPassword,
		deleteAccount,
	} = useProfile();

	// Handle name change flow
	const handleNameChange = () => {
		showPrompt(
			"Update First Name",
			"Please enter your first name:",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Next",
					onPress: (firstName) => {
						if (firstName) {
							showPrompt(
								"Update Last Name",
								"Please enter your last name:",
								[
									{ text: "Cancel", style: "cancel" },
									{
										text: "Update",
										onPress: (lastName) => {
											if (lastName) {
												updateName(firstName, lastName);
											}
										},
									},
								],
								{ defaultValue: userData?.lastName },
							);
						}
					},
				},
			],
			{ defaultValue: userData?.firstName },
		);
	};

	// Handle join company flow
	const handleJoinCompany = () => {
		showPrompt("Join Company", "Enter the company access code:", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Join",
				onPress: async (accessCode) => {
					if (!accessCode || accessCode.trim() === "") {
						Alert.alert(
							"Error",
							"Please enter a valid access code",
						);
						return;
					}

					const companyId = await joinCompany(accessCode);

					if (companyId) {
						showConfirmation(
							"Success",
							"You've successfully joined the company. Would you like to switch to it now?",
							() => handleCompanyChange(companyId),
						);
					} else {
						Alert.alert(
							"Error",
							"Invalid access code or you're already a member of this company",
						);
					}
				},
			},
		]);
	};

	// Handle email change flow
	const handleEmailChange = async () => {
		try {
			await reauthenticate();

			showPrompt("Update Email", "Please enter your new account email:", [
				{ text: "Cancel", style: "cancel" },
				{
					text: "Submit",
					onPress: (email) => {
						if (email) {
							showConfirmation(
								"Confirm Email Change",
								`Are you sure you want to change to ${email}?`,
								async () => {
									const success = await updateEmail(email);
									if (success) {
										Alert.alert(
											"Verification Email Sent",
											"Please check your new email address and verify the change. For security purposes, please login again.",
											[
												{
													text: "Logout",
													onPress: signOut,
												},
											],
										);
									}
								},
							);
						}
					},
				},
			]);
		} catch (error) {
			console.error("Authentication failed:", error);
		}
	};

	// Handle password reset
	const handlePasswordReset = () => {
		showConfirmation(
			"Reset Password",
			"Are you sure you want to reset your password?",
			resetPassword,
		);
	};

	// Handle account deletion
	const handleDeleteAccount = async () => {
		const title = isSolo
			? "Delete Account?"
			: `Delete ${userData?.loggedInCompany} Data?`;

		showConfirmation(
			title,
			"Are you sure you want to delete your company account? This action cannot be undone.",
			async () => {
				try {
					await reauthenticate();
					await deleteAccount();
				} catch (error) {
					console.error("Delete account failed:", error);
					Alert.alert(
						"Error",
						"An error occurred. Please try again.",
					);
				}
			},
			"Delete",
			"destructive",
		);
	};

	if (isLoading || !userData) {
		return <LoadingScreen />;
	}

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<View style={styles.content}>
				<ProfileHeader
					firstName={userData.firstName}
					lastName={userData.lastName}
					onNamePress={handleNameChange}
					onBackPress={() => navigation.goBack()}
				/>

				<View style={styles.section}>
					<Text style={styles.label}>Email</Text>
					<View style={styles.row}>
						<Text style={styles.value}>{userData.email}</Text>
						<Button
							title="Change"
							onPress={handleEmailChange}
							style={styles.changeEmailButton}
							textStyle={styles.buttonText}
							variant="outline"
							size="small"
						/>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.label}>Company</Text>
					{Object.keys(userData.companies).length > 1 ? (
						<Dropdown
							data={Object.keys(userData.companies).map(
								(company: string) => ({
									label: company,
									value: company,
								}),
							)}
							value={userData.loggedInCompany}
							onChange={(item) => handleCompanyChange(item.value)}
							labelField="label"
							valueField="value"
							style={styles.dropdown}
						/>
					) : (
						<Text style={styles.value}>
							{isSolo ? "Personal" : userData.loggedInCompany}
						</Text>
					)}

					<Button
						title="Join Another Company"
						onPress={handleJoinCompany}
						style={styles.joinCompanyButton}
						textStyle={styles.buttonText}
						variant="outline"
						fullWidth
					/>
				</View>

				<View style={styles.buttonContainer}>
					<Button
						title="Reset Password"
						onPress={handlePasswordReset}
						style={styles.resetButton}
						textStyle={styles.buttonText}
						variant="outline"
						fullWidth
					/>
				</View>

				<View style={styles.deleteButtonContainer}>
					<Button
						title="Delete Company Profile"
						onPress={handleDeleteAccount}
						style={styles.deleteButton}
						textStyle={styles.deleteButtonText}
						variant="destructive"
						fullWidth
					/>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		paddingHorizontal: 16,
	},
	content: {
		flex: 1,
	},
	section: {
		marginBottom: 24,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
		paddingBottom: 16,
	},
	label: {
		fontSize: 14,
		fontWeight: "500",
		color: "#757575",
		marginBottom: 8,
		textTransform: "uppercase",
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	value: {
		fontSize: 16,
		color: "#333",
		flex: 1,
		paddingVertical: 8,
	},
	button: {
		backgroundColor: "#f0f0f0",
		paddingVertical: 10,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 8,
	},
	buttonText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#333",
	},
	changeEmailButton: {
		backgroundColor: "#f0f0f0",
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 6,
		marginLeft: 12,
	},
	joinCompanyButton: {
		backgroundColor: "#e6f2ff",
		marginTop: 12,
	},
	dropdown: {
		height: 48,
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 12,
		marginBottom: 12,
	},
	buttonContainer: {
		marginTop: 16,
		marginBottom: 12,
	},
	resetButton: {
		backgroundColor: "#e6e6e6",
		paddingVertical: 12,
	},
	deleteButtonContainer: {
		marginTop: 24,
	},
	deleteButton: {
		backgroundColor: "#ffebee", // Light red
		paddingVertical: 14,
		marginTop: 16,
	},
	deleteButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#d32f2f", // Red
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 32,
		paddingTop: 16,
	},
	profileNameContainer: {
		alignItems: "center",
	},
	nameText: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333",
		marginBottom: 4,
	},
	backIcon: {
		position: "absolute",
		left: 0,
	},
	divider: {
		height: 1,
		backgroundColor: "#e0e0e0",
		marginVertical: 16,
	},
	propertyRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	modalContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0,0,0,0.5)",
	},
	modalContent: {
		width: "80%",
		backgroundColor: "white",
		borderRadius: 10,
		padding: 20,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	input: {
		width: "100%",
		height: 48,
		borderWidth: 1,
		borderColor: "#e0e0e0",
		borderRadius: 8,
		paddingHorizontal: 12,
		marginVertical: 12,
		fontSize: 16,
	},
});

export default ProfilePage;
