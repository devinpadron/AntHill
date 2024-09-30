import { db } from "../../config";

/* A User class that contains:
 - DB object ID
 - First Name
 - Last Name
 - Email
 - Phone Number
 - Username
 - A getter function for each var to pull from the DB using the item ID
 - A setter function for each var to update the DB using the item ID
*/
export class User {
  private userID: string = "";
  private firstName: string = "";
  private lastName: string = "";
  private email: string = "";
  private phoneNumber: string = "";
  private username: string = "";
  private company: string = "";
  private privilege: string = "USER";

  public getUserID() {
    console.log("userID");
  }
}
