import { compareVersions } from "compare-versions";
import * as AppConfig from "../../app.config";
import { Linking, Platform } from "react-native";
import { getRequiredVersion } from "../services/appConfigService";

const APP_STORE_ID = "6739265058";
const PLAY_STORE_ID = "com.anthillapp.anthill";

/**
 * Gets the current app version
 * @returns The current app version string
 */
export const getCurrentAppVersion = (): string => {
	return AppConfig.default.expo.version;
};

/**
 * Fetches the required version from the database
 * @returns Promise resolving to the required version string, or null if unknown
 */
export const fetchRequiredVersion = async (): Promise<string | null> => {
	return getRequiredVersion();
};

/**
 * Checks if the app needs to be updated.
 *
 * Fails open: when the required version cannot be read or does not parse, this
 * reports no update required. A Firestore outage must not brick the app.
 */
export const checkAppVersion = async (): Promise<{
	updateRequired: boolean;
	currentVersion: string;
	requiredVersion: string | null;
}> => {
	const currentVersion = getCurrentAppVersion();
	const requiredVersion = await fetchRequiredVersion();

	if (!requiredVersion) {
		return { updateRequired: false, currentVersion, requiredVersion };
	}

	let updateRequired = false;
	try {
		updateRequired = compareVersions(currentVersion, requiredVersion) < 0;
	} catch (e) {
		console.error("Error comparing app versions", e);
	}

	return { updateRequired, currentVersion, requiredVersion };
};

/**
 * Opens this app's listing in the platform app store.
 */
export const openAppStore = async (): Promise<void> => {
	const url =
		Platform.OS === "ios"
			? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`
			: `market://details?id=${PLAY_STORE_ID}`;

	try {
		const supported = await Linking.canOpenURL(url);

		if (supported) {
			await Linking.openURL(url);
			return;
		}

		// Fall back to the browser when the store app isn't installed
		await Linking.openURL(
			Platform.OS === "ios"
				? `https://apps.apple.com/app/id${APP_STORE_ID}`
				: `https://play.google.com/store/apps/details?id=${PLAY_STORE_ID}`,
		);
	} catch (e) {
		console.error("Error opening app store:", e);
	}
};
