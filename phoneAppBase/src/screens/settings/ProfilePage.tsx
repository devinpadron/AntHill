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
import prompt from "react-native-prompt-android";

const ProfilePage = () => {
	const [isLoading, setIsLoading] = useState(true);
	const [userData, setUserData] = useState(null);
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
						setUserData({
							...userData,
							companies: companies,
							selectedCompany: userData.company,
						});
					});
				setIsLoading(false);
			}
		};
		fillCompanyData();
	}, [userData]);

	const handleEmailChange = () => {
		if (Platform.OS == "android") {
			prompt(
				"Update Email",
				"Please enter your new account email:",
				[
					{
						text: "Cancel",
						onPress: () => console.log("Cancel"),
						style: "cancel",
					},
					{
						text: "Submit",
						onPress: (text) => changeEmail(text),
					},
				],
				{
					type: "plain-text",
				}
			);
		}
		Alert.prompt(
			"Update Email",
			"Please enter your new account email:",
			[
				{
					text: "Cancel",
					onPress: () => console.log("Cancel"),
					style: "cancel",
				},
				{
					text: "Submit",
					onPress: (text) => changeEmail(text),
					isPreferred: true,
				},
			],
			"plain-text"
		);
	};

	const changeEmail = (newEmail: string) => {
		auth().currentUser.verifyBeforeUpdateEmail(newEmail);

		Alert.alert(
			"Check your email!",
			"Please verify your new email for the changes to take effect"
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
						// Implement password reset logic here
					},
				},
			]
		);
	};

	const handleDeleteAccount = () => {
		Alert.alert(
			"Delete Account",
			"Are you sure you want to delete your account? This action cannot be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => {
						// Implement account deletion logic here
					},
				},
			]
		);
	};

	return !isLoading ? (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Text style={styles.header}>
					{userData.firstName + userData.lastName}
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
					{userData.companies.length > 1 ? (
						<Dropdown
							data={userData.companies.map((company) => ({
								label: company,
								value: company,
							}))}
							value={userData.selectedCompany}
							onChange={(item) =>
								setUserData({
									...userData,
									selectedCompany: item.value,
								})
							}
							labelField="label"
							valueField="value"
							style={styles.dropdown}
						/>
					) : (
						<Text style={styles.value}>
							{userData.selectedCompany}
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
							Delete Account
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
