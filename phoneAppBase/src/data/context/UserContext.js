import React, { createContext, useState, useContext, useEffect } from 'react';
import UserController from '../controller/userController';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const login = async () => {
    try {
      setUser(await UserController.getUser("jltq3bIySj070uboGDBy")); //testUserID
      setIsLoggedIn(true);
    } catch (error) {
      console.error("Error logging in:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
  };

  return (
    <UserContext.Provider value={{ user, isLoggedIn, isLoading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);