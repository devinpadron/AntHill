import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../../index";
import { getUser } from "./userController";

export interface Company {
	accessCode: string;
}

export async function compareAccessCode(accessCode: string) {
	let data = null;
	try {
		//Retrieve event data
		const companyEntry = await db
			.collection("Companies")
			.where("accessCode", "==", accessCode)
			.get();
		companyEntry.forEach((doc) => {
			if (doc.data().accessCode == accessCode) {
				data = doc.id;
			}
		});
	} catch (e) {
		console.error("Error getting company", e);
		return null;
	}
	return data;
}

export async function getAllUsersInCompany(company: string) {
	const employees: {} = {};
	try {
		const userEntries = await db
			.collection("Companies")
			.doc(company)
			.collection("Users")
			.get();
		for (const doc of userEntries.docs) {
			const data = await getUser(doc.id);
			if (data) {
				employees[doc.id] = data;
			} else {
				throw new Error("User not found");
			}
		}
	} catch (e) {
		console.error("Error finding users ", e);
		return null;
	}
	return employees;
}

export function subscribeAllUsersInCompany(
	company: string,
	onSnap: (
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>
	) => void
) {
	return db
		.collection("Companies")
		.doc(company)
		.collection("Users")
		.onSnapshot(onSnap);
}

// A new user is added to the company with the default privilege of "User"
// A new user will never have anythign other than "User" privilege since they must be upgraded by an admin later.
export async function addUserToCompany(company: string, userID: string) {
	try {
		await db
			.collection("Companies")
			.doc(company)
			.collection("Users")
			.doc(userID)
			.set({});
		return true;
	} catch (e) {
		console.error("Error adding user to company", e);
		return false;
	}
}

export async function getUserPrivilege(company: string, userID: string) {
	try {
		const userEntry = await db.collection("Users").doc(userID).get();
		if (userEntry.exists) {
			const dbData = userEntry.data();
			if (dbData) {
				return dbData.companies.get(company);
			} else {
				console.log("Document exists but data is undefined");
				return null;
			}
		} else {
			console.log("No such document");
			return null;
		}
	} catch (e) {
		console.error("Error getting user privilege", e);
		return null;
	}
}
