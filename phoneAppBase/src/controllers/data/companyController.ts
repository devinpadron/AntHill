import db from "../../../firebaseConfig";
import UserController from "./userController";

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
		const employees: {} = {};
		try {
			const userEntries = await db
				.collection("Companies")
				.doc(company)
				.collection("Users")
				.get();
			const userController = new UserController();
			for (const doc of userEntries.docs) {
				const privilege = doc.data().privilege;
				const data = await userController.getUser(doc.id);
				const employeeJson = {
					privilege: privilege,
					...data,
				};
				employees[doc.id] = employeeJson;
			}
		} catch (e) {
			console.error("Error finding users ", e);
			return null;
		}
		return employees;
	};

	// A new user is added to the company with the default privilege of "User"
	// A new user will never have anythign other than "User" privilege since they must be upgraded by an admin later.
	public addUserToCompany = async (company: string, userID: string) => {
		try {
			await db
				.collection("Companies")
				.doc(company)
				.collection("Users")
				.doc(userID)
				.set({ privilege: "User" });
			return true;
		} catch (e) {
			console.error("Error adding user to company", e);
			return false;
		}
	};

	public getUserPrivilege = async (company: string, userID: string) => {
		try {
			const userEntry = await db
				.collection("Companies")
				.doc(company)
				.collection("Users")
				.doc(userID)
				.get();
			if (userEntry.exists) {
				const dbData = userEntry.data();
				if (dbData) {
					return dbData.privilege;
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
	};
}
