export default {
	expo: {
		name: "AntHill",
		slug: "AntHill",
		version: "1.0.7",
		orientation: "portrait",
		userInterfaceStyle: "light",
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
				// if you allow camera, you need to add this
				NSCameraUsageDescription:
					"AntHill needs to access your Camera so that you can take photos",
				NSMicrophoneUsageDescription:
					"AntHill needs to access your microphone so that you can record audio",
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
		},
	},
};
