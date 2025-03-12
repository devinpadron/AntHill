import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, Platform } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { TouchableOpacity } from "react-native-gesture-handler";
import {
	reAuth,
	signOut,
	sendResetPassword,
} from "../../controllers/authController";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LoadingScreen from "../LoadingScreen";
import prompt from "react-native-prompt-android";
import auth from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import {
	deleteUser,
	subscribeCurrentUser,
	swapUserCompany,
	updateUser,
} from "../../controllers/userController";
import {
	deleteSoloCompany,
	isPersonal,
	removeUserFromCompany,
} from "../../controllers/companyController";

const ProfilePage = ({ navigation }) => {
	const [isLoading, setIsLoading] = useState(true);
	const [userData, setData] = useState(null);
	const [isSolo, setIsSolo] = useState(false);
	const [userId, setUserId] = useState("");
	const insets = useSafeAreaInsets();

	useEffect(() => {
		const subscriber = subscribeCurrentUser((user) => {
			const userData = user.data();
			if (userData) {
				setData(userData);
				setUserId(user.id);
			}
		});
		return () => subscriber();
	}, []);

	useEffect(() => {
		const fillData = async () => {
			if (userData) {
				const result = await isPersonal(userData.loggedInCompany);
				setIsSolo(result);
				setIsLoading(false);
			}
		};
		fillData();
	}, [userData]);

	// Add this function to update the name in Firebase
	const updateUserName = async (firstName: string, lastName: string) => {
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

	const handleNameChange = () => {
		// First, prompt for first name
		if (Platform.OS === "android") {
			prompt(
				"Update First Name",
				"Please enter your first name:",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Next",
						onPress: (firstName) => {
							if (firstName) {
								// Then prompt for last name
								prompt(
									"Update Last Name",
									"Please enter your last name:",
									[
										{ text: "Cancel", style: "cancel" },
										{
											text: "Update",
											onPress: (lastName) => {
												if (lastName) {
													updateUserName(
														firstName,
														lastName,
													);
												}
											},
										},
									],
									{
										type: "plain-text",
										defaultValue: userData.lastName,
									},
								);
							}
						},
					},
				],
				{ type: "plain-text", defaultValue: userData.firstName },
			);
		} else {
			// iOS flow
			Alert.prompt(
				"Update First Name",
				"Please enter your first name:",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Next",
						onPress: (firstName) => {
							if (firstName) {
								Alert.prompt(
									"Update Last Name",
									"Please enter your last name:",
									[
										{ text: "Cancel", style: "cancel" },
										{
											text: "Update",
											onPress: (lastName) => {
												if (lastName) {
													updateUserName(
														firstName,
														lastName,
													);
												}
											},
										},
									],
									"plain-text",
									userData.lastName,
								);
							}
						},
					},
				],
				"plain-text",
				userData.firstName,
			);
		}
	};

	const handleCompanyChange = async (selectedCompany: any) => {
		await swapUserCompany(userId, selectedCompany);
		return;
	};

	const reAuthenticatePrompt = async () =>
		new Promise((resolve, reject) => {
			const handlePress = async (password: string) => {
				if (await reAuth(password)) {
					resolve("Success");
				} else {
					reject("Error");
				}
			};
			if (Platform.OS === "android") {
				prompt(
					"Current Password",
					"Please enter your current password to continue:",
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Continue",
							onPress: handlePress,
						},
					],
					{ type: "secure-text" },
				);
			} else {
				Alert.prompt(
					"Current Password",
					"Please enter your current password to continue:",
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Continue",
							onPress: handlePress,
						},
					],
					"secure-text",
				);
			}
		});

	const handleEmailChange = async () => {
		await reAuthenticatePrompt().catch((error) => {
			console.error(error);
			return;
		});

		const confirmEmail = (email: string) => {
			Alert.alert(
				email,
				"Are you sure you want to change to this email?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Change",
						onPress: () => {
							changeEmail(email);
						},
					},
				],
			);
		};

		// If reauthentication successful, prompt for new email
		if (Platform.OS === "android") {
			prompt(
				"Update Email",
				"Please enter your new account email:",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Submit",
						onPress: (text) => confirmEmail(text),
					},
				],
				{ type: "plain-text" },
			);
		} else {
			Alert.prompt(
				"Update Email",
				"Please enter your new account email:",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Submit",
						onPress: (text) => confirmEmail(text),
					},
				],
				"plain-text",
			);
		}
	};

	const changeEmail = async (newEmail: string) => {
		const user = auth().currentUser;
		if (!user) {
			return;
		}
		// send email to update
		await user.verifyBeforeUpdateEmail(newEmail).catch((error) => {
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
		});
		Alert.alert(
			"Verification Email Sent",
			"Please check your new email address and verify the change. For security purposes, please login again.",
			[
				{
					text: "Logout",
					style: "default",
					onPress: async () => signOut(),
				},
			],
		);
	};

	const handlePasswordReset = () => {
		Alert.alert(
			"Reset Password",
			"Are you sure you want to reset your password?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Reset",
					onPress: () => {
						sendResetPassword(userData.email);
					},
				},
			],
		);
	};

	const handleDeleteAccount = () => {
		var title = "Delete " + userData.loggedInCompany + " Data?";
		if (isSolo) {
			title = "Delete Account?";
		}
		Alert.alert(
			title,
			"Are you sure you want to delete your company account? This action cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await reAuthenticatePrompt();
						} catch (e) {
							console.error(e);
							Alert.alert(
								"Error",
								"An error occurred. Please try again.",
							);
							return;
						}

						if (isSolo) {
							await deleteSoloCompany(userData.loggedInCompany);
							await deleteUser(userId);
						}
						await removeUserFromCompany(
							userData.loggedInCompany,
							userId,
						);
					},
				},
			],
		);
	};
	return !isLoading ? (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<View style={styles.content}>
				<View style={styles.header}>
					<TouchableOpacity
						containerStyle={{
							position: "absolute",
							left: 20,
							zIndex: 1,
						}}
						onPress={() => {
							navigation.goBack();
						}}
					>
						<Ionicons name="chevron-back" size={28} color="#000" />
					</TouchableOpacity>
					<TouchableOpacity onPress={handleNameChange}>
						<Text
							style={[
								styles.headerTitle,
								{ textDecorationLine: "underline" },
							]}
						>
							{userData.firstName + " " + userData.lastName}
						</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.section}>
					<Text style={styles.label}>Email</Text>
					<View style={styles.row}>
						<Text style={styles.value}>{userData.email}</Text>
						<TouchableOpacity
							style={[styles.button, styles.changeEmailButton]}
							onPress={handleEmailChange}
						>
							<Text style={styles.buttonText}>Change</Text>
						</TouchableOpacity>
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
				</View>

				<View style={styles.buttonContainer}>
					<TouchableOpacity
						style={[styles.button, styles.resetButton]}
						onPress={handlePasswordReset}
					>
						<Text style={styles.buttonText}>Reset Password</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.deleteButtonContainer}>
					<TouchableOpacity
						style={[styles.deleteButton, styles.button]}
						onPress={handleDeleteAccount}
					>
						<Text style={styles.deleteButtonText}>
							Delete Company Profile
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	) : (
		<LoadingScreen />
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
		backgroundColor: "#fff",
	},
	header: {
		display: "flex",
		marginBottom: 24,
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
	},
	section: {
		marginBottom: 24,
	},
	label: {
		fontSize: 16,
		fontWeight: "600",
		marginBottom: 8,
	},
	value: {
		fontSize: 16,
		color: "#666",
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	button: {
		padding: 10,
		borderRadius: 8,
		marginVertical: 8,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
		textAlign: "center",
	},
	buttonContainer: {
		marginTop: 24,
	},
	resetButton: {
		backgroundColor: "#FF9500",
	},
	deleteButton: {
		backgroundColor: "#FF3B30",
	},
	changeEmailButton: {
		backgroundColor: "#007AFF",
	},
	dropdown: {
		height: 50,
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 8,
	},
	content: {
		flex: 1,
	},
	scrollContainer: {
		flex: 1,
	},
	deleteButtonContainer: {
		position: "absolute",
		bottom: 0,
		width: "100%",
		padding: 20,
		backgroundColor: "#fff",
	},
	deleteButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
		textAlign: "center",
	},
});

export default ProfilePage;
