import firebase from "@react-native-firebase/app";
import { getFirestore } from "@react-native-firebase/firestore/";
import { AppRegistry } from "react-native";
import App from "./App";
import messaging from "@react-native-firebase/messaging";

const cateringApp = firebase.app();
var db = getFirestore(cateringApp);
if (__DEV__ == true) {
	db = getFirestore(cateringApp, "test");
}

export default db;

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
