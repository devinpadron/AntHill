import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, Platform } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { TouchableOpacity } from "react-native-gesture-handler";
import {
	reAuth,
	signOut,
	sendResetPassword,
	deleteCurrentUser,
} from "../../controllers/authController";
import { SafeAreaView } from "react-native-safe-area-context";
import LoadingScreen from "../LoadingScreen";
import prompt from "react-native-prompt-android";
import auth from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import {
	deleteUser,
	subscribeCurrentUser,
} from "../../controllers/userController";

const ProfilePage = ({ navigation }) => {
	const [isLoading, setIsLoading] = useState(true);
	const [userData, setData] = useState(null);

	useEffect(() => {
		const subscriber = subscribeCurrentUser((user) => {
			const userData = user.data();
			if (userData) {
				setData(userData);
			}
		});
		return () => subscriber();
	}, []);

	useEffect(() => {
		if (userData) {
			setIsLoading(false);
		}
	}, [userData]);

	const handleCompanyChange = async (selectedCompany: any) => {
		console.log("Company change to " + selectedCompany);
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
							onPress: handlePress,
						},
					],
					"secure-text"
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
		await user.verifyBeforeUpdateEmail(newEmail).catch((error) => {
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
		Alert.alert(
			"Verification Email Sent",
			"Please check your new email address and verify the change. For security purposes, please login again.",
			[
				{
					text: "Logout",
					style: "default",
					onPress: async () => signOut(),
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
						sendResetPassword(userData.email);
					},
				},
			]
		);
	};

	const handleDeleteAccount = () => {
		Alert.alert(
			"Delete " + userData.loggedInCompany + " Data?",
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
						await deleteUser(userData.id);
						if (userData.companies.length > 1) {
							//TODO: Implement switch company logic here
						} else {
							await deleteCurrentUser();
						}
					},
				},
			]
		);
	};

	return !isLoading ? (
		<SafeAreaView style={styles.container}>
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
					<Text style={styles.headerTitle}>
						{userData.firstName + " " + userData.lastName}
					</Text>
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
					{userData.companies.length > 1 ? (
						<Dropdown
							data={userData.companies.map((company) => ({
								label: company,
								value: company,
							}))}
							value={userData.loggedInCompany}
							onChange={(item) => handleCompanyChange(item.value)}
							labelField="label"
							valueField="value"
							style={styles.dropdown}
						/>
					) : (
						<Text style={styles.value}>
							{userData.loggedInCompany}
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
