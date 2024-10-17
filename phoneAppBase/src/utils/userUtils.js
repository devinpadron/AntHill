import User from '../data/class/userClass'
import UserController from '../controller/userController';

async function createTestUser(){
    const newUser = new User;
    newUser.setFirstName("testFirstName");
    newUser.setLastName("testLastName");
    newUser.setEmail("testemail@gmail.com");
    newUser.setCompany("testCompany");
    newUser.setPrivilege("testPrivilege");
    await UserController.addUser(newUser);
}

export { createTestUser }
