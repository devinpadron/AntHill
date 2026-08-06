export default {
	expo: {
		name: "AntHill",
		slug: "AntHill",
		// 1.2.0 is the redesign. required_version in Firestore is untouched —
		// this is a visual release, not a forced cutover.
		// 1.1.x is the v2-schema line. The minor bump is deliberate: it makes the
		// v1/v2 boundary legible in a support conversation ("are you on 1.0 or
		// 1.1?"), which matters during a cutover where the two read different
		// databases. required_version stays 1.0.100 until the migration window —
		// raising it now would force everyone onto a build that then gates itself
		// behind activeVersion 1.
		version: "1.2.0",
		orientation: "portrait",
		// The app themes itself off the OS appearance, so it must be told about
		// the OS appearance. Pinned to "light" until the theme layer existed.
		userInterfaceStyle: "automatic",
		// SDK 54 defaults the New Architecture on. Staying on the legacy
		// architecture keeps reanimated v3 / flash-list v1 and the
		// unmaintained native deps (html-to-pdf, fs) working. SDK 54 is the
		// last release that supports legacy — migrate before SDK 55.
		newArchEnabled: false,
		assetBundlePatterns: ["**/*"],
		// The native launch screen carries NO image — see the expo-splash-screen
		// plugin below. The mark is drawn by src/screens/SplashScreen.tsx so it
		// can animate and follow the theme; a static PNG here would show the
		// logo twice, in two different treatments, on every cold start.
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
			/*
			 * A solid colour, and nothing else.
			 *
			 * The OS always shows something between the tap and the JS bundle
			 * booting — that cannot be removed. What it CAN be is invisible:
			 * painting it the colour the app opens on means the only splash
			 * anyone perceives is the animated one React draws
			 * (src/screens/SplashScreen.tsx). A logo here would show the mark
			 * twice, in two different treatments, on every cold start.
			 *
			 * `image` IS REQUIRED even though nothing should be drawn. With it
			 * omitted, prebuild emits a storyboard whose layout constraints
			 * bind to an image view it then does not create — a malformed
			 * launch screen that can fail to unarchive. A 1×1 transparent PNG
			 * satisfies the template and paints nothing.
			 *
			 * `dark` matters as much as the default: without it the launch
			 * screen flashes white before a dark-themed app appears. The two
			 * colours are `neutral[50]` and `dark.bg` from src/theme/palette.ts
			 * — native config cannot import from JS, so they are duplicated
			 * here and have to be changed together.
			 */
			[
				"expo-splash-screen",
				{
					image: "./src/assets/AntHill/splash-blank.png",
					imageWidth: 1,
					backgroundColor: "#F7F8F5",
					dark: {
						image: "./src/assets/AntHill/splash-blank.png",
						backgroundColor: "#0E100D",
					},
				},
			],
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
