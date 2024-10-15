import firebase from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import { getFirestore } from '@react-native-firebase/firestore/';
import db from '../../../firebaseConfig';
import User from "../class/userClass";

/* A UserController that contains:
  - A function that uses a userID to pull from Firestore and returns a User class
  - A function that uses a userID to update exisiting user data
  - A function that uses a userID to delete a user from Firestore
  - A function that creates a new User and puts it into Firestore
*/


class UserControllerStruct {
  public getUser = async (userID:string) => {
    try {
      //Retrieve user data
      const userEntry = await db.collection('users').doc(userID).get();
      if (userEntry.exists) {
        const dbData = userEntry.data();
        if (dbData) {
          const foundUser = new User;
          foundUser.setUserID(userID);
          foundUser.setFirstName(dbData.firstName);
          foundUser.setLastName(dbData.lastName);
          foundUser.setEmail(dbData.email);
          foundUser.setCompany(dbData.company);
          foundUser.setPrivilege(dbData.privilege);
          return foundUser;
        } else {
          console.log("Document exists but data is undefined");
          return null;
        }
      } else {
        console.log("No such document");
        return null
    }
    } catch (e) {
      console.log("Error getting user", e);
    }
  }

  public deleteUser = async (userID:string) => {
    // Delete an existing user
    try {
      await db.collection('users').doc(userID).delete();
      console.log("User successfully deleted");
      return true;
    } catch (e) {
      console.error("Error deleting user:", e);
      throw e;
    }
  }

  public addUser = async (newUser:User) => {
    const userData = {
      firstName: newUser.getFirstName(),
      lastName: newUser.getLastName(),
      email: newUser.getEmail(),
      company: newUser.getCompany(),
      privilege: newUser.getPrivilege()
    }
    try {
      const entry = await db.collection('users').add(userData);
      const entryid = entry.id;
      newUser.setUserID(entryid)
      return entryid;
    } catch (e) {
      console.error("Error adding user:", e);
      throw e;
    }
  }

  public updateUser = async (userID: string, userData: object) => {
    try {
      await db.collection('users').doc(userID).update(userData);
      console.log("User successfully updated");
      return true;
    } catch (e) {
      console.error("Error updating user:", e);
      throw e;
    }
  };
}

const UserController = new UserControllerStruct;

export default UserController;