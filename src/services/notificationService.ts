import messaging from "@react-native-firebase/messaging";
import firestore from "@react-native-firebase/firestore";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import db from "../constants/firestore";

// Request notification permissions from the user
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

// Get the FCM token for the device
export const getFCMToken = async () => {
	const token = await messaging().getToken();
	return token;
};

// Set up notification listeners for the app
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

// Save the FCM token to the user's profile in Firestore
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

// Clear the FCM token from the user's profile in Firestore
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

// Subscribe to multiple FCM topics
export const subscribeToTopics = async (topics: string[]): Promise<void> => {
	try {
		const subscribePromises = topics.map(async (topic) => {
			// Sanitize topic name to follow FCM requirements (alphanumeric and underscores only)
			const sanitizedTopic = topic.replace(/[^a-zA-Z0-9_]/g, "_");

			await messaging().subscribeToTopic(sanitizedTopic);
			console.log(`Subscribed to topic: ${sanitizedTopic}`);
			return sanitizedTopic;
		});

		await Promise.all(subscribePromises);
	} catch (error) {
		console.error("Error subscribing to topics:", error);
		// Don't throw to prevent app crashes - just log the error
	}
};

// Unsubscribe from multiple FCM topics
export const unsubscribeFromTopics = async (
	topics: string[],
): Promise<void> => {
	try {
		const unsubscribePromises = topics.map(async (topic) => {
			// Sanitize topic name to follow FCM requirements (alphanumeric and underscores only)
			const sanitizedTopic = topic.replace(/[^a-zA-Z0-9_]/g, "_");

			await messaging().unsubscribeFromTopic(sanitizedTopic);
			console.log(`Unsubscribed from topic: ${sanitizedTopic}`);
			return sanitizedTopic;
		});

		await Promise.all(unsubscribePromises);
	} catch (error) {
		console.error("Error unsubscribing from topics:", error);
		// Don't throw to prevent app crashes - just log the error
	}
};

// Unsubscribe from all FCM topics (helper function for logout)
export const unsubscribeFromAllTopics = async (
	topics: string[],
): Promise<void> => {
	try {
		await unsubscribeFromTopics(topics);
		console.log("Unsubscribed from all topics");
	} catch (error) {
		console.error("Error unsubscribing from all topics:", error);
	}
};
