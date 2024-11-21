import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../../firebaseConfig";

interface Company {
	accessCode: string;
}

export default class CompanyController {
	public compareAccessCode = async (accessCode: string) => {
		try {
			//Retrieve event data
			const companyEntry = await db
				.collection("Companies")
				.where("accessCode", "==", accessCode)
				.get();
			companyEntry.forEach((doc) => {
				if (doc.data().accessCode == accessCode) {
					return doc.id;
				}
			});
		} catch (e) {
			console.error("Error getting company", e);
		}
		return null;
	};

	public searchUserByEmail = async (email: string) => {
		var data;
		try {
			const userEntry = await db
				.collectionGroup("Users")
				.where("email", "==", email)
				.get();
			data = userEntry.docs.at(0).data();
		} catch (e) {
			console.error("Error finding user ", e);
		}
		return data;
	};

	// The reason for this is because it may be possible to have a single user appear multiple times in the database
	// if they work for multiple companies. This will help mass update data across all companies when they request to change it.
	public getAllUsersByID = async (id: string) => {
		try {
			const userEntries = await db
				.collectionGroup("Users")
				.where("id", "==", id)
				.get();
			return userEntries;
		} catch (e) {
			console.error("Error finding users ", e);
		}
		return null;
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
		}
		return null;
	};
}
