import React, {createContext, useState, useEffect, useContext } from 'react';
import auth from '@react-native-firebase/auth';
import UserController from '../data/controller/userController';
import User from '../data/class/userClass';

const AuthContext = createContext();

export const AuthProvider = ({children}) => {
    const [user, setUser] = useState(null);
    const [firestoreData, setFirestoreData] = useState(new User);
    const [isLoading, setIsLoading] = useState(true);

    useEffect (() => {
        const subscriber = auth().onAuthStateChanged(async user => {
            setUser(user);
            setIsLoading(false);

            if (user) {
                try {
                    const userData = await UserController.getUser(user.id);
                    setFirestoreData(userData);
                } catch (error) {
                    console.error("Error getting user data:", error);
                }
            } else {
                setFirestoreData(null);
            }
        });

        return subscriber;
    }, []);

    const Login = async (email, password) => {
        try {
            await auth().signInWithEmailAndPassword(email, password)
            .then(() => {
                console.log('User account signed in!');
              });
        } catch (error) {
              if (error.code === 'auth/invalid-email') {
                console.log('That email address is invalid!');
              }
          
              console.error('Login error', error);
        }
    };

    const SignUp = async (email, password) => {
        try {
            await auth().createUserWithEmailAndPassword()
            .then(() => {
                console.log('User account created & signed in!');
              });
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                console.log('That email address is already in use!');
              }
          
              if (error.code === 'auth/invalid-email') {
                console.log('That email address is invalid!');
              }
          
              console.error('Signup error', error);
        }
    };

    const LogOut = async () => {
        try {
            await auth().signOut()
            .then(() => console.log('User signed out!'));
        } catch (error) {
            console.error('Signout Error', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, firestoreData, Login, SignUp, LogOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};