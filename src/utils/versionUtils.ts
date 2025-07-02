import { compareVersions } from "compare-versions";
import * as AppConfig from "../../app.config";
import db from "../constants/firestore";
import { Alert, Linking, Platform } from "react-native";

// App store URLs - replace with your actual app IDs
const APP_STORE_ID = "6739265058"; // Your iOS App Store ID
const PLAY_STORE_ID = "YOUR_PACKAGE_NAME"; // Your Android package name

/**
 * Gets the current app version
 * @returns The current app version string
 */
export const getCurrentAppVersion = (): string => {
	return AppConfig.default.expo.version; // Replace with actual implementation
};

/**
 * Fetches the required version from the database
 * @returns Promise resolving to the required version string
 */
export const fetchRequiredVersion = async (): Promise<string> => {
	try {
		const data = await db.collection("AppData").doc("Data").get();
		return data.data()?.required_version;
	} catch (error) {
		console.error("Failed to fetch required version:", error);
		// Return current version to avoid false update prompts on error
		return getCurrentAppVersion();
	}
};

/**
 * Checks if the app needs to be updated
 * @returns Promise resolving to an object with update status and versions
 */
export const checkAppVersion = async (): Promise<{
	updateRequired: boolean;
	currentVersion: string;
	requiredVersion: string;
}> => {
	const currentVersion = getCurrentAppVersion();
	const requiredVersion = await fetchRequiredVersion();

	// Compare versions (returns -1 if current < required, 0 if equal, 1 if current > required)
	const updateRequired = compareVersions(currentVersion, requiredVersion) < 0;

	return {
		updateRequired,
		currentVersion,
		requiredVersion,
	};
};

/**
 * Shows update notification to the user and redirects to store when confirmed
 * @param currentVersion Current app version
 * @param requiredVersion Required app version
 */
export const showUpdateNotification = (
	currentVersion: string,
	requiredVersion: string,
): void => {
	console.warn(
		`App update required! Current version: ${currentVersion}, Required version: ${requiredVersion}`,
	);

	// Get the appropriate store URL based on platform
	const getStoreURL = () => {
		if (Platform.OS === "ios") {
			return `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`;
		} else {
			// Google Play fallback to browser if Play Store isn't available
			return `market://details?id=${PLAY_STORE_ID}`;
		}
	};

	// Open the appropriate app store
	const openAppStore = async () => {
		const url = getStoreURL();

		try {
			const supported = await Linking.canOpenURL(url);

			if (supported) {
				await Linking.openURL(url);
			} else {
				// Fallback for Android if market:// scheme isn't supported
				if (Platform.OS === "android") {
					await Linking.openURL(
						`https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`,
					);
				} else {
					console.warn("Cannot open app store URL:", url);
				}
			}
		} catch (error) {
			console.error("Error opening app store:", error);
		}
	};

	// Show alert with update option
	Alert.alert(
		"Update Required",
		`Your app version (${currentVersion}) is outdated. Please update to the latest version (${requiredVersion}).`,
		[
			{
				text: "Update Now",
				onPress: openAppStore,
			},
			// {
			// 	text: "Later",
			// 	style: "cancel",
			// },
		],
		{ cancelable: false },
	);
};
