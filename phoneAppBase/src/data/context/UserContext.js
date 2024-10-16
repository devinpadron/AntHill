import React, { createContext, useState, useContext, useEffect } from 'react';
import UserController from '../controller/userController';
import auth from '@react-native-firebase/auth';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setUser(user);
      if (initializing) setInitializing(false);
    });

    return unsubscribe;
  }, []);

  const signIn = (email, password) => {
    return auth().signInWithEmailAndPassword(email, password);
  };

  const signUp = (email, password) => {

    return auth().createUserWithEmailAndPassword(email, password);
  };

  const signOut = (email, password) => {
    return auth().signOut();
  };

  const value ={
    user,
    initializing,
    signIn,
    signUp,
    signOut
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
