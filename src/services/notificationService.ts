import { Alert, PermissionsAndroid, Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";
import db from "../constants/firestore";
import firestore from "@react-native-firebase/firestore";

export const requestNotificationPermissions = async () => {
	if (Platform.OS === "android") {
		const authStatus = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
		);
		const enabled = authStatus === PermissionsAndroid.RESULTS.GRANTED;
		if (enabled) {
			console.log("Authorization status:", authStatus);
		}
		return enabled;
	} else if (Platform.OS === "ios") {
		const authStatus = await messaging().requestPermission();
		const enabled =
			authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
			authStatus === messaging.AuthorizationStatus.PROVISIONAL;

		if (enabled) {
			console.log("Authorization status:", authStatus);
		}
		return enabled;
	}
};

export const getFCMToken = async () => {
	const token = await messaging().getToken();
	return token;
};

export const setupNotificationListeners = () => {
	// Handle foreground messages
	const unsubscribe = messaging().onMessage(async (remoteMessage) => {
		Alert.alert(
			"New Notification",
			remoteMessage.notification?.body || JSON.stringify(remoteMessage),
		);
	});

	return unsubscribe;
};

export const saveTokenToUserProfile = async (token: string, userId: string) => {
	try {
		await db
			.collection("Users")
			.doc(userId)
			.update({
				fcmToken: firestore.FieldValue.arrayUnion(token),
			});
		console.log("FCM token saved to user profile:", userId);
	} catch (error) {
		console.error("Error saving FCM token to user profile:", error);
		Alert.alert(
			"Error",
			"Failed to save notification token. Please try again later.",
		);
	}
	return true;
};

export const clearNotificationToken = async (token: string, userId: string) => {
	try {
		// Use arrayRemove to remove only the specific token
		await db
			.collection("Users")
			.doc(userId)
			.update({
				fcmToken: firestore.FieldValue.arrayRemove(token),
			});
		console.log("FCM token removed for user:", userId, "Token:", token);
	} catch (error) {
		console.error("Error removing FCM token:", error);
	}
};
