import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import db from "../../../firebaseConfig";

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
