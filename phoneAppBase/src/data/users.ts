import { db } from "../../config";
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'

/* A User class that contains:
 - DB object ID
 - First Name
 - Last Name
 - Email
 - Phone Number
 - Company
 - Privilege level
 - A getter function for each var
 - A setter function for each var
*/
class User {
  private userID: string = "";
  private firstName: string = "";
  private lastName: string = "";
  private email: string = "";
  private phoneNumber: string = "";
  private company: string = "";
  private privilege: string = "USER";

  public getUserID() {
    return this.userID;
  }
  public setUserID(newID:string) {
    this.userID = newID;
  }
  
  public getFirstName() {
    return this.firstName;
  }

  public setFirstName(newFirstName:string) {
    this.firstName = newFirstName;
  }

  public getLastName() {
    return this.lastName;
  }

  public setLastName(newLastName:string) {
    this.lastName = newLastName;
  }

  public getEmail() {
    return this.email;
  }

  public setEmail(newEmail:string) {
    this.email = newEmail;
  }

  public getPhoneNumber() {
    return this.phoneNumber;
  }

  public setPhoneNumber(newPhoneNumber:string) {
    this.phoneNumber = newPhoneNumber;
  }

  public getCompany(){
    return this.company;
  }

  public setCompany(newCompany:string) {
    this.company = newCompany;
  }

  public getPrivilege() {
    return this.privilege;
  }

  public setPrivilege(newPrivilege:string) {
    this.privilege = newPrivilege;
  }

}

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
      const foundUser = new User;
      foundUser.setFirstName(docSnap.data().firstName);
      foundUser.setLastName(docSnap.data().lastName);
      foundUser.setEmail(docSnap.data().email);
      foundUser.setPhoneNumber(docSnap.data().phoneNumber);
      foundUser.setCompany(docSnap.data().company);
      foundUser.setPrivilege(docSnap.data().privilege);
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
      phoneNumber: newUser.getPhoneNumber(),
      company: newUser.getCompany(),
      privilege: newUser.getPrivilege()
    }
    await setDoc(doc(db, 'users', newUser.getUserID()), data);
  }
  
}

const UserController = new UserControllerStruct;

export { User, UserController };
