import React from "react";
import {
	View,
	Alert,
	ScrollView,
	TouchableOpacity,
	StatusBar,
	StyleProp,
	ViewStyle,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import LoadingScreen from "../LoadingScreen";
import { useProfile } from "../../hooks/settings/useProfile";
import { showPrompt, showConfirmation } from "../../utils/alertUtils";
import { Text } from "../../components/ui/Text";
import { Icon } from "../../components/ui/Icon";
import { Card } from "../../components/ui/Card";
import { Avatar } from "../../components/ui/Avatar";
import { Divider } from "../../components/ui/Divider";
import { useUser } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Rust } from "../../constants/colors";

const ProfilePage = ({ navigation }) => {
	const { theme, mode } = useTheme();
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

	const fullName =
		`${userData.firstName ?? ""} ${userData.lastName ?? ""}`.trim();

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: theme.Background }}
			edges={["top"]}
		>
			<StatusBar
				barStyle={mode === "dark" ? "light-content" : "dark-content"}
			/>

			{/* Header */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
					paddingHorizontal: 20,
					paddingTop: 8,
					paddingBottom: 12,
				}}
			>
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					hitSlop={8}
					style={{
						width: 38,
						height: 38,
						borderRadius: 12,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: theme.Surface,
						borderWidth: 0.5,
						borderColor: theme.BorderColor,
					}}
				>
					<Icon name="chevL" size={18} color={theme.PrimaryText} />
				</TouchableOpacity>
				<Text variant="h2" weight="semibold">
					Profile
				</Text>
			</View>

			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: 20,
					paddingTop: 8,
					paddingBottom: 40,
				}}
				showsVerticalScrollIndicator={false}
			>
				{/* Identity hero */}
				<Card padding="md" onPress={handleNameChange}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 16,
						}}
					>
						<Avatar name={fullName || userData.email} size="lg" />
						<View style={{ flex: 1 }}>
							<Text variant="h2" weight="semibold">
								{fullName || "Your name"}
							</Text>
							<Text
								variant="caption"
								color="tertiary"
								style={{ marginTop: 2 }}
							>
								Tap to edit name
							</Text>
						</View>
						<Icon
							name="chev"
							size={18}
							color={theme.TertiaryText}
						/>
					</View>
				</Card>

				{/* Account */}
				<SectionLabel>Account</SectionLabel>
				<Card padding="none">
					<InfoRow
						label="Email"
						value={userData.email}
						action={
							<ActionChip
								label="Change"
								onPress={handleEmailChange}
							/>
						}
					/>
					<Divider soft inset={20} />
					<InfoRow
						label="Phone"
						value={userData.phone}
						placeholder="No phone number added"
						action={
							<ActionChip
								label={userData.phone ? "Change" : "Add"}
								onPress={handlePhoneChange}
							/>
						}
					/>
				</Card>

				{/* Company */}
				<SectionLabel>Company</SectionLabel>
				<Card padding="md">
					<Text
						variant="eyebrow"
						color="tertiary"
						style={{ fontSize: 11, marginBottom: 8 }}
					>
						Active company
					</Text>
					<Dropdown
						data={userData.companies.map((company) => ({
							label: company,
							value: company,
						}))}
						value={userData.loggedInCompany}
						onChange={(item) => handleCompanyChange(item.value)}
						labelField="label"
						valueField="value"
						style={{
							height: 50,
							borderColor: theme.BorderColor,
							borderWidth: 0.5,
							borderRadius: 14,
							paddingHorizontal: 16,
							backgroundColor: theme.Surface2 ?? theme.Surface,
						}}
						placeholderStyle={{
							color: theme.TertiaryText,
							fontSize: 15,
						}}
						selectedTextStyle={{
							color: theme.PrimaryText,
							fontSize: 15,
							fontWeight: "500",
						}}
						activeColor={theme.AccentSoft}
						containerStyle={{ borderRadius: 14, marginTop: 4 }}
						maxHeight={220}
						disable={userData.companies.length <= 1}
					/>
					<TouchableOpacity
						onPress={handleJoinCompany}
						activeOpacity={0.9}
						style={{
							marginTop: 12,
							height: 48,
							borderRadius: 14,
							alignItems: "center",
							justifyContent: "center",
							flexDirection: "row",
							gap: 8,
							borderWidth: 0.5,
							borderColor: theme.BorderColor,
							backgroundColor: theme.AccentSoft,
						}}
					>
						<Icon
							name="plus"
							size={16}
							color={theme.AccentStrong}
						/>
						<Text variant="body" color="accent" weight="semibold">
							Join another company
						</Text>
					</TouchableOpacity>
				</Card>

				{/* Security */}
				<SectionLabel>Security</SectionLabel>
				<Card padding="none">
					<InfoRow
						label="Password"
						value="••••••••"
						action={
							<ActionChip
								label="Reset"
								onPress={handlePasswordReset}
							/>
						}
					/>
				</Card>

				{/* Danger zone */}
				<SectionLabel>Danger zone</SectionLabel>
				<TouchableOpacity
					onPress={handleDeleteAccount}
					activeOpacity={0.9}
					style={{
						height: 52,
						borderRadius: 16,
						alignItems: "center",
						justifyContent: "center",
						flexDirection: "row",
						gap: 8,
						borderWidth: 0.5,
						borderColor: Rust[500],
						backgroundColor: theme.ErrorSoft ?? Rust[100],
					}}
				>
					<Text
						variant="body"
						weight="semibold"
						style={{ color: Rust[500] }}
					>
						Delete {userData?.loggedInCompany} profile
					</Text>
				</TouchableOpacity>
			</ScrollView>
		</SafeAreaView>
	);
};

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<Text
			variant="eyebrow"
			color="tertiary"
			style={{
				fontSize: 11,
				marginTop: 24,
				marginBottom: 10,
				marginLeft: 4,
			}}
		>
			{children}
		</Text>
	);
}

function InfoRow({
	label,
	value,
	placeholder,
	action,
}: {
	label: string;
	value?: string;
	placeholder?: string;
	action: React.ReactNode;
}) {
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				padding: 16,
			}}
		>
			<View style={{ flex: 1 }}>
				<Text
					variant="eyebrow"
					color="tertiary"
					style={{ fontSize: 11, marginBottom: 4 }}
				>
					{label}
				</Text>
				<Text variant="body" color={value ? "primary" : "tertiary"}>
					{value || placeholder}
				</Text>
			</View>
			{action}
		</View>
	);
}

function ActionChip({
	label,
	onPress,
	style,
}: {
	label: string;
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
}) {
	const { theme } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			style={[
				{
					paddingHorizontal: 16,
					height: 36,
					borderRadius: 999,
					alignItems: "center",
					justifyContent: "center",
					borderWidth: 0.5,
					borderColor: theme.BorderColor,
					backgroundColor: theme.Surface,
				},
				style,
			]}
		>
			<Text variant="small" color="accent" weight="semibold">
				{label}
			</Text>
		</TouchableOpacity>
	);
}

export default ProfilePage;
