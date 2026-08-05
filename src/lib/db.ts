import firebase from "@react-native-firebase/app";
import { getFirestore } from "@react-native-firebase/firestore";
import { DATABASE_ID } from "../constants/database";

/*
 * The single shared Firestore handle.
 *
 * The database is chosen by DATABASE_ID in src/constants/database.ts — under
 * __DEV__ that is a SEPARATE database named "test", so dev writes can never
 * reach production. Never construct a Firestore instance anywhere else.
 *
 * Only modules under src/services/** may import this. The pre-commit guard
 * enforces that — see tools/check-layering.sh.
 */
const app = firebase.app();

const db =
	DATABASE_ID === "(default)"
		? getFirestore(app)
		: getFirestore(app, DATABASE_ID);

export default db;
