import React, { useEffect, useState } from "react";
import {
	View,
	Text,
	TextInput,
	Button,
	Alert,
	StyleSheet,
	ScrollView,
	Dimensions,
} from "react-native";
import auth from "@react-native-firebase/auth";
import UserController from "../../controller/userController";
import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import LoadingScreen from "../LoadingScreen";

const { width, height } = Dimensions.get("window");

const ProfilePage = ({ navigation }: any) => {
	const [userData, setUserData] =
		useState<FirebaseFirestoreTypes.DocumentData>();
	const [password, setPassword] = useState<string>("");
	// HARD CODED COMPANY PLEASE REPLACE!!!
	const userController = new UserController("SoBridalSocial");

	const handlePasswordChange = (newPassword: string) => {
		setPassword(newPassword);
	};

	const handleDeleteAccount = () => {
		Alert.alert(
			"Delete Account",
			"Are you sure you want to delete your account?",
			[
				{ text: "Cancel", style: "cancel" },
				// Add account deletion functionality
				{
					text: "DELETE",
					style: "destructive",
					onPress: async () => {
						await userController
							.deleteUser(auth().currentUser!.uid)
							.catch((error) => {
								Alert.alert("Error: " + error.message);
							});
						await auth()
							.currentUser?.delete()
							.catch((error) => {
								Alert.alert("Error: " + error.message);
							});
					},
				},
			],
		);
	};

	const handleSaveChanges = () => {
		// Add phone number update functionality
		// Add password change functionality
		console.log(userData);
	};

	useEffect(() => {
		async function getDetails() {
			try {
				const user = await userController.getUser(
					auth().currentUser!.uid,
				);
				if (user) {
					setUserData(user);
				} else {
					Alert.alert("Data could not be retrieved.");
				}
			} catch (e) {
				Alert.alert("Error: " + e);
			}
		}
		getDetails();
	}, []);

	if (!userData) {
		return <LoadingScreen />;
	}
	return (
		<View style={styles.container}>
			<ScrollView contentContainerStyle={styles.content}>
				<Text style={styles.label}>Name</Text>
				<TextInput
					style={styles.input}
					value={`${userData.firstName} ${userData.lastName}`}
					editable={false}
				/>

				<Text style={styles.label}>Email</Text>
				<TextInput
					style={styles.input}
					value={userData.email}
					editable={false}
				/>

				<Text style={styles.label}>Company</Text>
				<TextInput
					style={styles.input}
					value={userData.company}
					editable={false}
				/>

				<Text style={styles.label}>Password</Text>
				<TextInput
					style={styles.input}
					value={password}
					onChangeText={handlePasswordChange}
					secureTextEntry
					placeholder="Enter new password"
				/>

				<Button title="Save Changes" onPress={handleSaveChanges} />
			</ScrollView>

			<View style={styles.deleteButtonContainer}>
				<Button
					title="Delete Account"
					color="red"
					onPress={handleDeleteAccount}
				/>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: width * 0.05,
	},
	content: {
		flexGrow: 1,
		justifyContent: "flex-start",
		paddingTop: height * 0.08,
	},
	label: {
		fontSize: height * 0.02,
		marginBottom: height * 0.01,
		fontWeight: "bold",
	},
	input: {
		borderColor: "#ccc",
		borderWidth: 1,
		padding: width * 0.04,
		marginBottom: height * 0.02,
		borderRadius: width * 0.02,
	},
	deleteButtonContainer: {
		justifyContent: "flex-end",
		paddingBottom: height * 0.01,
	},
	centered: {
		justifyContent: "center",
		alignItems: "center",
	},
});

export default ProfilePage;
