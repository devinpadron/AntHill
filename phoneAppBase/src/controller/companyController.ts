import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../../firebaseConfig";

interface Company {
	accessCode: string;
}

export default class CompanyController {
	public compareAccessCode = async (accessCode: string) => {
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
	};

	//Return first instance of user with matching email.
	//Used when we need to find a user by email but don't yet know their company.
	public searchUserByEmail = async (email: string) => {
		let data = null;
		try {
			const userEntry = await db
				.collectionGroup("Users")
				.where("email", "==", email)
				.get();
			data = userEntry.docs.at(0).data();
		} catch (e) {
			console.error("Error finding user ", e);
			return null;
		}
		return data;
	};

	// The reason for this is because it may be possible to have a single user appear multiple times in the database
	// if they work for multiple companies. This will help mass update data across all companies when they request to change it.
	public getAllUsersByEmail = async (email: string) => {
		try {
			const userEntries = await db
				.collectionGroup("Users")
				.where("email", "==", email)
				.get();
			return userEntries;
		} catch (e) {
			console.error("Error finding users ", e);
			return null;
		}
	};

	public updateAllUsersByEmail = async (email: string, data: any) => {
		try {
			const userEntries = await this.getAllUsersByEmail(email);
			userEntries.forEach((doc) => {
				doc.ref.update(data);
			});
		} catch (e) {
			console.error("Error updating users ", e);
		}
	};

	public getAllUsersInCompany = async (company: string) => {
		try {
			const employees: [FirebaseFirestoreTypes.DocumentData] = [null];
			const userEntries = await db
				.collection("Companies")
				.doc(company)
				.collection("Users")
				.get();
			userEntries.forEach((doc) => {
				employees.push(doc.data());
			});
			return employees;
		} catch (e) {
			console.error("Error finding users ", e);
			return null;
		}
	};
}
