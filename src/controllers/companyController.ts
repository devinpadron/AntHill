import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../global/firestore";
import {
	deleteCompanyFromUser,
	getUser,
	swapUserCompany,
} from "./userController";

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
		snapshot: FirebaseFirestoreTypes.QuerySnapshot<FirebaseFirestoreTypes.DocumentData>,
	) => void,
) {
	return db
		.collection("Companies")
		.doc(company)
		.collection("Users")
		.onSnapshot(onSnap);
}

// A new user is added to the company with the default privilege of "User"
// A new user will never have anythign other than "User" privilege since they must be upgraded by an admin later.
export async function addUserToCompany(
	company: string,
	userID: string,
	personal: boolean = false,
) {
	try {
		await db
			.collection("Companies")
			.doc(company)
			.collection("Users")
			.doc(userID)
			.set({});

		if (personal) {
			await db
				.collection("Companies")
				.doc(company)
				.set({ personal: true });
		}
		return true;
	} catch (e) {
		console.error("Error adding user to company", e);
		return false;
	}
}

export async function isPersonal(company: string) {
	try {
		const companyEntry = await db
			.collection("Companies")
			.doc(company)
			.get();
		if (companyEntry.data().personal) {
			return true;
		}
		return false;
	} catch (e) {
		console.error("Error getting company", e);
		return null;
	}
}

//
export async function deleteSoloCompany(company: string) {
	try {
		const users = await db
			.collection("Companies")
			.doc(company)
			.collection("Users")
			.get();
		for (const user of users.docs) {
			await user.ref.delete();
		}
		const events = await db
			.collection("Companies")
			.doc(company)
			.collection("Events")
			.get();
		for (const event of events.docs) {
			await event.ref.delete();
		}
		await db.collection("Companies").doc(company).delete();
		return true;
	} catch (e) {
		console.error("Error deleting company", e);
		return false;
	}
}

export async function removeUserFromCompany(company: string, userID: string) {
	try {
		await db
			.collection("Companies")
			.doc(company)
			.collection("Users")
			.doc(userID)
			.delete();
		const result = await deleteCompanyFromUser(userID, company);
		if (result === 1) {
			return true;
		} else if (result != company) {
			return true;
		}
		await swapUserCompany(userID, "");
		return true;
	} catch (e) {
		console.error("Error removing user from company", e);
		return false;
	}
}

export const joinCompanyWithAccessCode = async (userId, accessCode) => {
	try {
		// Query companies collection for the access code
		const companySnapshot = await db
			.collection("Companies")
			.where("accessCode", "==", accessCode)
			.get();

		if (companySnapshot.empty) {
			return false; // No company found with this access code
		}

		// Get the company document
		const companyDoc = companySnapshot.docs[0];
		const companyId = companyDoc.id;
		const companyData = companyDoc.data();

		// Check if user is already a member
		const userCompaniesSnapshot = await db
			.collection("Users")
			.doc(userId)
			.get();

		const userData = userCompaniesSnapshot.data();
		if (userData.companies && userData.companies[companyId]) {
			return false; // User is already a member
		}

		// Add user to company's users collection
		await db
			.collection("Companies")
			.doc(companyId)
			.collection("Users")
			.doc(userId)
			.set({});

		// Add company to user's companies
		await db
			.collection("Users")
			.doc(userId)
			.update({
				[`companies.${companyId}`]: "User",
			});

		return companyId; // Return company ID for switching
	} catch (error) {
		console.error("Error joining company:", error);
		throw error;
	}
};
