import React from "react";
import { View, Text, StyleSheet, StatusBar, Alert } from "react-native";
import { SettingsItem } from "../../components/settings/SettingsItem";
import { ExpandableSettingsSection } from "../../components/settings/ExpandableSettingsSection";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";

const Settings = ({ navigation }: any) => {
	const insets = useSafeAreaInsets();

	const { isAdmin, logout, companyId } = useUser();
	const { preferences, isLoading } = useCompany();

	const handleLogout = () => {
		Alert.alert("Logout", "Are you sure you want to logout?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Logout",
				onPress: async () => {
					try {
						await logout();
					} catch (error) {
						console.error("Signout Error", error);
					}
				},
			},
		]);
	};

	if (isLoading) {
		return null; // or a loading spinner
	}

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<StatusBar barStyle="dark-content" />
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Settings</Text>
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
				<SettingsItem
					title="Profile"
					onPress={() => navigation.push("Profile")}
				/>
				<SettingsItem
					title="User Preferences"
					onPress={() => navigation.push("UserPreferences")}
				/>
			</View>

			{isAdmin ? (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>ADMIN</Text>
					<SettingsItem
						title="Company Preferences"
						onPress={() => navigation.push("CompanyPreferences")}
					/>
					<SettingsItem
						title="Employee List"
						onPress={() => navigation.push("EmployeeList")}
					/>
					{preferences.enableTimeSheet && (
						<SettingsItem
							title="Payroll Review"
							onPress={() => navigation.push("PayrollReview")}
						/>
					)}

					{/* Add the expandable Create section */}
					<ExpandableSettingsSection title="Create">
						<SettingsItem
							title="Submission Form"
							onPress={() => navigation.push("CompanyCustomForm")}
							style={styles.nestedItem}
						/>
						<SettingsItem
							title="Checklists"
							onPress={() => navigation.push("ChecklistCreator")}
							style={styles.nestedItem}
						/>
						<SettingsItem
							title="Packages"
							onPress={() => navigation.push("PackageCreator")}
							style={styles.nestedItem}
						/>
						<SettingsItem
							title="Labels"
							onPress={() => navigation.push("LabelCreator")}
							style={styles.nestedItem}
						/>
					</ExpandableSettingsSection>
				</View>
			) : null}

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>ACTIONS</Text>
				<SettingsItem title="Log Out" isAction onPress={handleLogout} />
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	header: {
		display: "flex",
		paddingTop: 10,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
		textAlign: "center",
	},
	section: {
		marginTop: 24,
	},
	sectionTitle: {
		fontSize: 12,
		fontWeight: "bold",
		color: "#888",
		marginLeft: 16,
		marginBottom: 8,
	},
	nestedItem: {
		paddingLeft: 16, // Indentation for nested items
	},
});

export default Settings;
