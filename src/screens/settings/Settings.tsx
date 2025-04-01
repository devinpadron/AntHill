import React from "react";
import { View, Text, StyleSheet, StatusBar, Alert } from "react-native";
import { SettingsItem } from "../../components/settings/SettingsItem";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../contexts/UserContext";

const Settings = ({ navigation }: any) => {
	const insets = useSafeAreaInsets();

	const { user: userData, isAdmin, logout } = useUser();

	const pushProfile = () => {
		navigation.push("Profile");
	};

	const pushEmployeeList = () => {
		navigation.push("EmployeeList");
	};

	const handleLogout = () => {
		Alert.alert("Logout", "Are you sure you want to logout?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Logout",
				onPress: async () => {
					try {
						logout();
					} catch (error) {
						console.error("Signout Error", error);
					}
				},
			},
		]);
	};

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<StatusBar barStyle="dark-content" />
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Settings</Text>
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
				<SettingsItem title="Profile" onPress={pushProfile} />
			</View>

			{isAdmin ? (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>ADMIN</Text>
					<SettingsItem
						title="Employee List"
						onPress={pushEmployeeList}
					/>
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
});

export default Settings;
