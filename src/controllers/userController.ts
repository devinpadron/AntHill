import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../global/firestore";
import auth from "@react-native-firebase/auth";

/* A UserController that contains:
  - A user interface that provides the structure of user data
  - A function that uses a userID to pull from Firestore and retrieve the user entry
  - A function that uses a userID to update exisiting user data
  - A function that uses a userID to delete a user from Firestore
  - A function that creates a new user entry and puts it into Firestore
*/

export interface User {
	firstName: string;
	lastName: string;
	email: string;
	loggedInCompany: string;
	companies: {
		[companyId: string]: string;
	};
}

export async function getUser(userID: string) {
	try {
		//Retrieve user data
		const userEntry = await db.collection("Users").doc(userID).get();
		if (userEntry.exists) {
			const dbData = userEntry.data();
			if (dbData) {
				return dbData as User;
			} else {
				console.log("Document exists but data is undefined");
				return null;
			}
		} else {
			console.log("No such document");
			return null;
		}
	} catch (e) {
		console.error("Error getting user", e);
	}
}

export async function getUserPrivilege(userID: string, company: string) {
	try {
		const userEntry = await db.collection("Users").doc(userID).get();
		if (userEntry.exists) {
			return userEntry.data().companies[company];
		} else {
			return null;
		}
	} catch (e) {
		console.log("Error getting user privilege", e);
		return null;
	}
}

export function subscribeCurrentUser(
	onSnap: (
		snapshot: FirebaseFirestoreTypes.DocumentSnapshot<FirebaseFirestoreTypes.DocumentData>
	) => void
) {
	return db
		.collection("Users")
		.doc(auth().currentUser.uid)
		.onSnapshot(onSnap);
}

export async function deleteUser(userID: string) {
	// Delete an existing user
	try {
		await db.collection("Users").doc(userID).delete();
		console.log("User successfully deleted");
		return true;
	} catch (e) {
		console.error("Error deleting user:", e);
		throw e;
	}
}

export async function addUser(newUser: User, userID: string) {
	try {
		await db.collection("Users").doc(userID).set(newUser);
	} catch (e) {
		console.error("Error adding user:", e);
		throw e;
	}
}

export async function updateUser(userID: string, userData: User) {
	try {
		await db.collection("Users").doc(userID).update(userData);
		console.log("User successfully updated");
		return true;
	} catch (e) {
		console.error("Error updating user:", e);
		throw e;
	}
}

export async function swapUserCompany(userID: string, companyID: string) {
	const userData = await getUser(userID);
	var companyID = companyID;
	console.log(companyID);
	if (companyID === "") {
		const companies = userData.companies;
		companyID = Object.keys(companies)[0];
		console.log(companyID);
	}

	if (!userData.companies[companyID]) {
		console.error("User does not belong to company");
		return false;
	}

	try {
		await db.collection("Users").doc(userID).update({
			loggedInCompany: companyID,
		});
		return true;
	} catch (e) {
		console.error("Error swapping user company:", e);
		throw e;
	}
}

export async function deleteCompanyFromUser(userID: string, companyID: string) {
	const userData = await getUser(userID);
	if (!userData.companies[companyID]) {
		console.error("User does not belong to company");
		return -1;
	}

	try {
		const companies = userData.companies;
		delete companies[companyID];
		await db.collection("Users").doc(userID).update({
			companies: companies,
		});
		if (companies.isEmpty) {
			await deleteUser(userID);
			return 1;
		}
		return userData.loggedInCompany;
	} catch (e) {
		console.error("Error deleting company from user:", e);
		throw e;
	}
}
