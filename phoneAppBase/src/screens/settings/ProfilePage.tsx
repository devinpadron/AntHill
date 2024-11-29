import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Alert,
	Platform,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import auth from "@react-native-firebase/auth";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LoadingScreen from "../LoadingScreen";
import CompanyController from "../../controller/companyController";
import UserController from "../../controller/userController";
import prompt from "react-native-prompt-android";

const ProfilePage = () => {
	const [isLoading, setIsLoading] = useState(true);
	const [userData, setUserData] = useState(null);
	const [companyData, setCompanyData] = useState(null);
	useEffect(() => {
		const fetchUserData = async () => {
			const user = await AsyncStorage.getItem("userData");
			if (user) {
				// Fetch user data from the server
				setUserData(JSON.parse(user));
			}
		};
		fetchUserData();
	}, []);

	useEffect(() => {
		const fillCompanyData = async () => {
			if (userData) {
				const companyController = new CompanyController();
				await companyController
					.getAllUsersByEmail(userData.email)
					.then((users) => {
						const companies = [];
						users.forEach((user) => {
							companies.push(user.data().company);
						});
						setCompanyData({
							companies: companies,
							selectedCompany: userData.company,
						});
					});
				setIsLoading(false);
			}
		};
		fillCompanyData();
	}, [userData]);

	const reAuthenticatePrompt = async () => {
		const reAuth = async (password: string) => {
			const user = auth().currentUser;
			if (!user?.email) {
				Alert.alert("Error", "No user is currently signed in");
				return;
			}

			// Reauthenticate with current credentials
			const credential = auth.EmailAuthProvider.credential(
				user.email,
				password
			);
			await user
				.reauthenticateWithCredential(credential)
				.catch((error) => {
					switch (error.code) {
						case "auth/wrong-password":
							Alert.alert(
								"Error",
								"Incorrect password. Please try again."
							);
							break;
						case "auth/invalid-credential":
							Alert.alert(
								"Error",
								"Invalid credentials. Please try again."
							);
							break;
						default:
							console.error("Reauthentication error:", error);
					}
				});
		};

		if (Platform.OS === "android") {
			prompt(
				"Current Password",
				"Please enter your current password to continue:",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Continue",
						onPress: async (password) => await reAuth(password),
					},
				],
				{ type: "secure-text" }
			);
		} else {
			Alert.prompt(
				"Current Password",
				"Please enter your current password to continue:",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Continue",
						onPress: async (password) => await reAuth(password),
					},
				],
				"secure-text"
			);
		}
	};

	const handleEmailChange = () => {
		try {
			reAuthenticatePrompt();
		} catch (e) {
			console.error(e);
			return;
		}

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
				]
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
				{ type: "plain-text" }
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
				"plain-text"
			);
		}
	};

	const changeEmail = async (newEmail: string) => {
		const user = auth().currentUser;
		if (!user) {
			return;
		}
		// send email to update
		await user.updateEmail(newEmail).catch((error) => {
			switch (error.code) {
				case "auth/invalid-email":
					Alert.alert("The email address is invalid");
					break;
				case "auth/email-already-in-use":
					Alert.alert(
						"This email is already in use by another account"
					);
					break;
				case "auth/requires-recent-login":
					Alert.alert(
						"For security, please sign out and sign in again to change your email"
					);
					break;
				default:
					console.error("Email update error:", error);
			}
		});
		await user.sendEmailVerification();
		try {
			const companyController = new CompanyController();

			// update all instances of user data in every company
			await companyController.updateAllUsersByEmail(userData.email, {
				...userData,
				email: newEmail,
			});
		} catch (error) {
			console.error("Error updating email in database:", error);
		}
		console.log("User email changed");
		Alert.alert(
			"Verification Email Sent",
			"Please check your new email address and verify the change. For security purposes, please login again.",
			[
				{
					text: "Logout",
					style: "default",
					onPress: async () => {
						await AsyncStorage.removeItem("userData");
						auth().signOut();
					},
				},
			]
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
						auth().sendPasswordResetEmail(userData.email);
						Alert.alert(
							"Reset Password",
							"Check your email to reset your password."
						);
					},
				},
			]
		);
	};

	const handleDeleteAccount = () => {
		Alert.alert(
			"Delete " + companyData.selectedCompany + " Data?",
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
								"An error occurred. Please try again."
							);
							return;
						}
						const userController = new UserController(
							companyData.selectedCompany
						);
						await userController.deleteUser(userData);
						if (companyData.companies.length > 1) {
							//TODO: Implement switch company logic here
						} else {
							await auth().currentUser.delete();
						}
					},
				},
			]
		);
	};

	return !isLoading ? (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.header}>
					{userData.firstName + " " + userData.lastName}
				</Text>

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
					{companyData.companies.length > 1 ? (
						<Dropdown
							data={companyData.companies.map((company) => ({
								label: company,
								value: company,
							}))}
							value={companyData.selectedCompany}
							onChange={(item) =>
								setCompanyData({
									...companyData,
									selectedCompany: item.value,
								})
							}
							labelField="label"
							valueField="value"
							style={styles.dropdown}
						/>
					) : (
						<Text style={styles.value}>
							{companyData.selectedCompany}
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
		</SafeAreaView>
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
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 24,
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
