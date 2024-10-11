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

export { User };
