import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
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
const db = getDatabase();

export { db };
