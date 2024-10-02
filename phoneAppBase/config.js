import Constants from "expo-constants";
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";
// import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAqrSwFQ0sNcaULNxZfpiYyu0cTY5jKZIQ",
  authDomain: "sobridalsocial-dabcd.firebaseapp.com",
  projectId: "sobridalsocial-dabcd",
  storageBucket: "sobridalsocial-dabcd.appspot.com",
  messagingSenderId: "824611477611",
  appId: "1:824611477611:web:dac0a698277844e539392e",
  measurementId: "G-L277WJJVVV",
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

if (__DEV__){
  connectFirestoreEmulator(db, Constants.expoConfig?.hostUri?.split(":").shift(), 8080);
}


export { db };
