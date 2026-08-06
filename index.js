import { AppRegistry } from "react-native";
import * as NativeSplash from "expo-splash-screen";
import App from "./App";
import messaging from "@react-native-firebase/messaging";

/*
 * Hold the native launch screen until React has something to show.
 *
 * Without this it hides the moment the bundle loads, which is BEFORE the first
 * frame is painted — so a cold start flashed the bare window between the launch
 * screen and the app. src/screens/SplashScreen.tsx releases it once mounted.
 *
 * Best-effort: a failure here must not stop the app registering.
 */
NativeSplash.preventAutoHideAsync().catch(() => {});

// Register background handler for push notifications

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
	console.log("Message handled in the background!", remoteMessage);
});
// Check if the app was launched in the background and return null is so
function HeadlessCheck({ isHeadless }) {
	if (isHeadless) {
		// App has been launched in the background by iOS, ignore
		return null;
	}
	// App has been launched in the foreground, render the app
	return <App />;
}
AppRegistry.registerComponent("AntHill", () => HeadlessCheck);
