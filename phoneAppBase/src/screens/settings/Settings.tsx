import React from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	TouchableOpacity,
	StatusBar,
	Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "../../controllers/auth/authController";

const Settings = ({ navigation }: any) => {
	//TODO: Implement isAdmin check to hide/show admin settings
	const [isAdmin, setIsAdmin] = React.useState(true);
	const SettingsItem: React.FC<{
		title: string;
		isAction?: boolean;
		onPress: () => void;
	}> = ({ title, isAction = false, onPress }) => (
		<TouchableOpacity style={styles.settingsItem} onPress={onPress}>
			<Text
				style={[styles.settingsItemText, isAction && styles.actionText]}
			>
				{title}
			</Text>
			{!isAction && (
				<Ionicons
					name="chevron-forward-outline"
					size={20}
					color="#888"
				/>
			)}
		</TouchableOpacity>
	);

	const pushProfile = () => {
		navigation.push("Profile");
	};

	const pushEventSubmit = () => {
		navigation.push("EventSubmit");
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
						signOut();
					} catch (error) {
						console.error("Signout Error", error);
					}
				},
			},
		]);
	};

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="dark-content" />
			<View style={styles.header}>
				<TouchableOpacity>
					<Ionicons name="chevron-back" size={28} color="#000" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Settings</Text>
				<TouchableOpacity>
					<Ionicons name="search" size={28} color="#000" />
				</TouchableOpacity>
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>ACCOUNT INFORMATION</Text>
				<SettingsItem title="Profile" onPress={pushProfile} />
			</View>

			{isAdmin ? (
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>ADMIN</Text>
					<SettingsItem
						title="Create New Event"
						onPress={pushEventSubmit}
					/>
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
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "bold",
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
	settingsItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	settingsItemText: {
		fontSize: 16,
	},
	actionText: {
		color: "red",
	},
});

export default Settings;
