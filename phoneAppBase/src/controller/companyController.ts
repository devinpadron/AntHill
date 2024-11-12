import db from "../../firebaseConfig";

interface Company {
	accessCode: string;
}

export default class CompanyController {
	public compareAccessCode = async (accessCode: string) => {
		var id = "";
		try {
			//Retrieve event data
			const companyEntry = await db
				.collection("Companies")
				.where("accessCode", "==", accessCode)
				.get();
			companyEntry.forEach((doc) => {
				if (doc.data().accessCode == accessCode) {
					id = doc.id;
				}
			});
		} catch (e) {
			console.log("Error getting company", e);
		}
		return id;
	};

	public searchUserByEmail = async (email: string) => {
		var id = "";
		try {
			const userEntry = await db
				.collectionGroup("Users")
				.where("email", "==", email)
				.get();
			userEntry.forEach((doc) => {
				if (doc.data().email == email) {
					id = doc.id;
				}
			});
		} catch (e) {
			console.log("Error finding user", e);
		}
		return id;
	};
}
