import { db } from "../../../config";
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'
import User from "../class/userClass";



/* A UserController that contains:
  - A function that uses a userID to pull from Firestore and returns a User class
  - A function that uses a userID to update exisiting user data
  - A function that uses a userID to delete a user from Firestore
  - A function that creates a new User and puts it into Firestore
*/

class UserControllerStruct {
  
  public getUser = async (userID:string) => {
    // Retrieve user data
    const docSnap = await getDoc(doc(db, "users", userID));
    if (docSnap.exists()) {
      const dbUser = docSnap.data()
      const foundUser = new User;
      foundUser.setFirstName(dbUser.firstName);
      foundUser.setLastName(dbUser.lastName);
      foundUser.setEmail(dbUser.email);
      foundUser.setCompany(dbUser.company);
      foundUser.setPrivilege(dbUser.privilege);
      foundUser.setUserID(userID);
      return foundUser;
    } else {
      console.log("No such document")
      return null
    }
  }

  public deleteUser = async (userID:string) => {
    // Delete an existing user
    await deleteDoc(doc(db, "users", userID))
  }

  public setUser = async (newUser:User) => {
    // Create a new user or update existing
    const data = {
      firstName: newUser.getFirstName(),
      lastName: newUser.getLastName(),
      email: newUser.getEmail(),
      company: newUser.getCompany(),
      privilege: newUser.getPrivilege()
    }
    await setDoc(doc(db, 'users', newUser.getUserID()), data);
  }
  
}

const UserController = new UserControllerStruct;

export default UserController;