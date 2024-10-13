import { testdb } from "../../../firebaseConfig";
import { doc, setDoc, deleteDoc, getDoc, addDoc, updateDoc, collection} from 'firebase/firestore';
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
      const userEntry = await getDoc(doc(testdb, 'users' , userID));
      if (userEntry.exists()) {
        const dbData = userEntry.data()
        const foundUser = new User;
        foundUser.setFirstName(dbData.firstName);
        foundUser.setLastName(dbData.lastName);
        foundUser.setEmail(dbData.email);
        foundUser.setCompany(dbData.company);
        foundUser.setPrivilege(dbData.privilege);
        foundUser.setUserID(userID);
        return foundUser;
      } else {
        console.log("No such document")
        return null
      }
    } catch (e) {
      console.log("Error getting user", e);
    }
  }

  public deleteUser = async (userID:string) => {
    // Delete an existing user
    try {
      await deleteDoc(doc(testdb, 'users' , userID));
      console.log("User successfully deleted");
      return true;
    } catch (e) {
      console.error("Error deleting user:", e);
      throw e;
    }
  }

  public addUser = async (newUser:User) => {
    const userData = {
      userID: newUser.getUserID(),
      firstName: newUser.getFirstName(),
      lastName: newUser.getLastName(),
      email: newUser.getEmail(),
      company: newUser.getCompany(),
      privilege: newUser.getPrivilege()
    }
    try {
      const entry = await addDoc(collection(testdb, 'users'), userData);
      const entryid = entry.id;

      const userWithId = {
        ...userData,
        userID: entryid
      };
      newUser.setUserID(entryid)
      return entryid;
    } catch (e) {
      console.error("Error adding user:", e);
      throw e;
    }
  }

  public updateUser = async (userID: string, userData: object) => {
    try {
      const userEntry = doc(testdb, 'users' , userID);
      await updateDoc(userEntry, userData);
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