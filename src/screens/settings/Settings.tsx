import React, { useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	StatusBar,
	Alert,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { signOut } from "../../controllers/authController";
import { subscribeCurrentUser } from "../../controllers/userController";

const Settings = ({ navigation }: any) => {
	const [isAdmin, setIsAdmin] = React.useState(false);
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

	useEffect(() => {
		const subscriber = subscribeCurrentUser((user) => {
			const userData = user.data();
			if (userData) {
				const privilege = userData.companies[userData.loggedInCompany];
				setIsAdmin(privilege === "Admin" || privilege === "Owner");
			}
		});
		return () => subscriber();
	}, []);

	const pushProfile = () => {
		navigation.push("Profile");
	};

	const pushEventSubmit = () => {
		navigation.navigate("EventSubmit", { event: null });
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
