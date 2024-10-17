import React, 
{ createContext, 
  useState, 
  useContext, 
  useEffect } from 'react';
import UserController from '../data/controller/userController';
import auth from '@react-native-firebase/auth';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [userData, setUserData] = useState(null);
  
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        const fullUserData = await UserController.getUser(user.uid);
        setUserData(fullUserData);
      } else {
        setUserData(null);
      }
      if (initializing) setInitializing(flase);
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

  const refreshUserData = async () => {
    if (user) {
      const fullUserData = await UserController.getUser(user.uid);
      setUserData(fullUserData);
    }
  };

  const value ={
    user,
    initializing,
    signIn,
    signUp,
    signOut,
    refreshUserData
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
