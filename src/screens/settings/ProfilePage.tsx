import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	Alert,
	ScrollView,
	TouchableOpacity,
	StatusBar,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LoadingScreen from "../LoadingScreen";
import { useProfile } from "../../hooks/settings/useProfile";
import { showPrompt, showConfirmation } from "../../utils/alertUtils";
import { Button } from "../../components/ui/Button";
import { useUser } from "../../contexts/UserContext";

const ProfilePage = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const {
		isLoading,
		userData,
		updateName,
		handleCompanyChange,
		joinCompany,
		reauthenticate,
		updateEmail,
		resetPassword,
		deleteAccount,
		updatePhone, // We'll need to add this to the useProfile hook
	} = useProfile();

	const { logout } = useUser();

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

	// Handle phone number change
	const handlePhoneChange = () => {
		showPrompt(
			"Update Phone Number",
			"Please enter your phone number:",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Update",
					onPress: async (phone) => {
						if (phone) {
							try {
								await updatePhone(phone);
								Alert.alert(
									"Success",
									"Phone number updated successfully",
								);
							} catch (error) {
								Alert.alert(
									"Error",
									"Failed to update phone number",
								);
							}
						}
					},
				},
			],
			{ defaultValue: userData?.phone || "", keyboardType: "phone-pad" },
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
													onPress: logout,
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
		const title = `Delete ${userData?.loggedInCompany} Data?`;

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
			<StatusBar barStyle="dark-content" />

			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons name="arrow-back" size={24} color="#333" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Profile</Text>
				<View style={{ width: 40 }} />
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				{/* Profile Card */}
				<View style={styles.profileCard}>
					<TouchableOpacity
						style={styles.profileHeader}
						onPress={handleNameChange}
						activeOpacity={0.7}
					>
						<View style={styles.avatarContainer}>
							<Text style={styles.avatarText}>
								{userData.firstName?.charAt(0) || ""}
								{userData.lastName?.charAt(0) || ""}
							</Text>
						</View>

						<View style={styles.nameContainer}>
							<Text style={styles.nameText}>
								{userData.firstName} {userData.lastName}
							</Text>
							<Text style={styles.editText}>Tap to edit</Text>
						</View>

						<Ionicons
							name="create-outline"
							size={20}
							color="#2089dc"
						/>
					</TouchableOpacity>
				</View>

				{/* Email Card */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons
							name="mail-outline"
							size={20}
							color="#2089dc"
							style={styles.cardIcon}
						/>
						<Text style={styles.cardTitle}>Email Address</Text>
					</View>

					<View style={styles.cardContent}>
						<Text style={styles.valueText}>{userData.email}</Text>

						<Button
							title="Change"
							onPress={handleEmailChange}
							style={styles.actionButton}
							textStyle={styles.actionButtonText}
							variant="outline"
							size="small"
						/>
					</View>
				</View>

				{/* Phone Number Card */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons
							name="call-outline"
							size={20}
							color="#2089dc"
							style={styles.cardIcon}
						/>
						<Text style={styles.cardTitle}>Phone Number</Text>
					</View>

					<View style={styles.cardContent}>
						<Text style={styles.valueText}>
							{userData.phone || "No phone number added"}
						</Text>

						<Button
							title={userData.phone ? "Change" : "Add"}
							onPress={handlePhoneChange}
							style={styles.actionButton}
							textStyle={styles.actionButtonText}
							variant="outline"
							size="small"
						/>
					</View>
				</View>

				{/* Company Card */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons
							name="business-outline"
							size={20}
							color="#2089dc"
							style={styles.cardIcon}
						/>
						<Text style={styles.cardTitle}>Company</Text>
					</View>

					<View
						style={[
							styles.cardContent,
							{ flexDirection: "column" },
						]}
					>
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
							placeholderStyle={styles.dropdownPlaceholder}
							selectedTextStyle={styles.dropdownSelectedText}
							activeColor="#e6f2ff" // Highlight color when item is selected
							containerStyle={{
								borderRadius: 8,
								marginTop: 4,
							}}
							maxHeight={200} // Maximum height of dropdown list
							disable={userData.companies.length <= 1}
						/>

						<Button
							title="Join Another Company"
							onPress={handleJoinCompany}
							style={styles.joinButton}
							textStyle={styles.joinButtonText}
							variant="outline"
							fullWidth
						/>
					</View>
				</View>

				{/* Security Card */}
				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<Ionicons
							name="shield-outline"
							size={20}
							color="#2089dc"
							style={styles.cardIcon}
						/>
						<Text style={styles.cardTitle}>Security</Text>
					</View>

					<View
						style={[
							styles.cardContent,
							{ flexDirection: "column" },
						]}
					>
						<Button
							title="Reset Password"
							onPress={handlePasswordReset}
							style={styles.resetButton}
							textStyle={styles.resetButtonText}
							variant="outline"
							fullWidth
							icon={
								<Ionicons
									name="key-outline"
									size={18}
									color="#666"
									style={{ marginRight: 8 }}
								/>
							}
						/>
					</View>
				</View>

				{/* Danger Zone */}
				<View style={styles.dangerCard}>
					<View style={styles.cardHeader}>
						<Ionicons
							name="warning-outline"
							size={20}
							color="#d32f2f"
							style={styles.cardIcon}
						/>
						<Text style={[styles.cardTitle, { color: "#d32f2f" }]}>
							Danger Zone
						</Text>
					</View>

					<View
						style={[
							styles.cardContent,
							{ flexDirection: "column" },
						]}
					>
						<Button
							title={`Delete ${userData?.loggedInCompany} Profile`}
							onPress={handleDeleteAccount}
							style={styles.deleteButton}
							textStyle={styles.deleteButtonText}
							variant="destructive"
							fullWidth
							icon={
								<Ionicons
									name="trash-outline"
									size={18}
									color="#d32f2f"
									style={{ marginRight: 8 }}
								/>
							}
						/>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
		flex: 1,
	},
	backButton: {
		padding: 8,
	},
	scrollView: {
		flex: 1,
	},
	contentContainer: {
		padding: 16,
		paddingBottom: 32,
	},
	profileCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	profileHeader: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
	},
	avatarContainer: {
		width: 60,
		height: 60,
		borderRadius: 30,
		backgroundColor: "#e6f2ff",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	avatarText: {
		fontSize: 22,
		fontWeight: "600",
		color: "#2089dc",
	},
	nameContainer: {
		flex: 1,
	},
	nameText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		marginBottom: 4,
	},
	editText: {
		fontSize: 12,
		color: "#888",
		fontStyle: "italic",
	},
	card: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	dangerCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
		borderLeftWidth: 4,
		borderLeftColor: "#d32f2f",
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	cardIcon: {
		marginRight: 10,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	cardContent: {
		padding: 16,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	valueText: {
		fontSize: 15,
		color: "#444",
		flex: 1,
	},
	actionButton: {
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#2089dc",
		backgroundColor: "transparent",
	},
	actionButtonText: {
		fontSize: 13,
		fontWeight: "500",
		color: "#2089dc",
	},
	dropdown: {
		height: 50,
		width: "100%",
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 16,
		marginBottom: 16,
		backgroundColor: "#f9f9f9", // Add background color for better contrast
	},
	dropdownPlaceholder: {
		color: "#999",
		fontSize: 16,
	},
	dropdownSelectedText: {
		color: "#333",
		fontSize: 16,
		fontWeight: "500", // Make selected text more visible
	},
	joinButton: {
		paddingVertical: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#2089dc",
		backgroundColor: "#e6f2ff",
	},
	joinButtonText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#2089dc",
	},
	resetButton: {
		paddingVertical: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#666",
		backgroundColor: "#f5f5f5",
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
	},
	resetButtonText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
	},
	deleteButton: {
		paddingVertical: 12,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#d32f2f",
		backgroundColor: "#ffebee",
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
	},
	deleteButtonText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#d32f2f",
	},
});

export default ProfilePage;
