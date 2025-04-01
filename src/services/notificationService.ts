import { Alert, PermissionsAndroid, Platform } from "react-native";
import messaging from "@react-native-firebase/messaging";

export const requestNotificationPermissions = async () => {
	if (Platform.OS === "android") {
		await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
		);
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
	console.log("FCM Token:", token);
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
