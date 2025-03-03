import firebase from "@react-native-firebase/app";
import { getFirestore } from "@react-native-firebase/firestore/";

const cateringApp = firebase.app();
var db = getFirestore(cateringApp);
if (__DEV__ == true) {
	db = getFirestore(cateringApp, "test");
}

export default db;
