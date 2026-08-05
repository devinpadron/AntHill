export default {
	expo: {
		name: "AntHill",
		slug: "AntHill",
		// 1.1.x is the v2-schema line. The minor bump is deliberate: it makes the
		// v1/v2 boundary legible in a support conversation ("are you on 1.0 or
		// 1.1?"), which matters during a cutover where the two read different
		// databases. required_version stays 1.0.100 until the migration window —
		// raising it now would force everyone onto a build that then gates itself
		// behind activeVersion 1.
		version: "1.1.1",
		orientation: "portrait",
		userInterfaceStyle: "light",
		// SDK 54 defaults the New Architecture on. Staying on the legacy
		// architecture keeps reanimated v3 / flash-list v1 and the
		// unmaintained native deps (html-to-pdf, fs) working. SDK 54 is the
		// last release that supports legacy — migrate before SDK 55.
		newArchEnabled: false,
		assetBundlePatterns: ["**/*"],
		splash: {
			image: "./src/assets/AntHill/Full_Black.png",
			resizeMode: "contain",
			backgroundColor: "#ffffff",
		},
		icon: "./src/assets/AntHill/AH_Icon.png",
		ios: {
			supportsTablet: true,
			googleServicesFile:
				process.env.GOOGLE_SERVICES_PLIST ??
				"./GoogleService-Info.plist",
			bundleIdentifier: "com.anthillapp.anthill",
			entitlements: {
				"aps-environment": "production",
			},
			infoPlist: {
				ITSAppUsesNonExemptEncryption: false,
				NSPhotoLibraryAddUsageDescription:
					"AntHill needs photo library permissions to save photos",
				NSPhotoLibraryUsageDescription:
					"AntHill needs photo library permissions to save photos",
				NSCameraUsageDescription:
					"AntHill needs to access your Camera so that you can take photos",
				NSMicrophoneUsageDescription:
					"AntHill needs to access your microphone so that you can record audio",
				NSUserNotificationsUsageDescription:
					"AntHill needs to send you notifications to keep you updated on your tasks and activities.",
				UIBackgroundModes: ["fetch", "remote-notification"],
				LSApplicationQueriesSchemes: ["itms-apps"],
			},
		},
		android: {
			googleServicesFile:
				process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
			package: "com.anthillapp.anthill",
		},
		plugins: [
			"@react-native-firebase/app",
			"@react-native-firebase/auth",
			"@react-native-firebase/crashlytics",
			"expo-video",
			"expo-mail-composer",
			[
				"expo-build-properties",
				{
					ios: {
						useFrameworks: "static",
					},
				},
			],
		],
		extra: {
			eas: {
				projectId: "1a855cc1-8887-47e2-a13a-fd2fbb15b8c1",
			},
			GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
		},
	},
};
