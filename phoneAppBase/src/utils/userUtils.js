import { User } from '../data/users';
import { UserController } from '../controllers/UserController';

function createTestUser(){
    const newUser = new User;
    newUser.setUserID("testUserID");
    newUser.setFirstName("testFireName");
    newUser.setLastName("testLastName");
    newUser.setEmail("testemail@gmail.com");
    newUser.setCompany("testCompany");
    newUser.setPrivilege("testPrivilege");
    UserController.setUser(newUser);
}

export { createTestUser }
