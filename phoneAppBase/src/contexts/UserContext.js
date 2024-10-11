import React, { createContext, useState, useContext } from 'react';
import { UserController } from '../controllers/UserController';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const login = () => {
    setUser(UserController.getUser("testUserID"))
    setIsLoggedIn(true);
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
  };

  const setUserData = (userData) => {
    setUser(userData);
  };

  return (
    <UserContext.Provider value={{ user, isLoggedIn, login, logout, setUserData }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);