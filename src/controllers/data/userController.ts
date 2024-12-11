import db from "../../../firebaseConfig";

/*
  STILL NEED TO DO:
  - Integrate user privilege and company logic into users.
*/

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
	companies: string[];
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
