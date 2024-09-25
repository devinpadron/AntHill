import React from "react";
import { NavigationContainer } from "@react-navigation/native";

//Navigation Control
import HomeTabs from "./src/routes/homeTabs";
import AuthStack from "./src/routes/authStack";

// const [isLoggedIn, setIsLoggedIn] = useState(false);

// const handleSetIsLoggedIn = useCallback((value) => {
//   console.log("App.js: Setting isLoggedIn to", value);
//   setIsLoggedIn(value);
// }, []);

// //Firebase
// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// import { getMessaging } from "firebase/messaging";

// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyAqrSwFQ0sNcaULNxZfpiYyu0cTY5jKZIQ",
//   authDomain: "sobridalsocial-dabcd.firebaseapp.com",
//   projectId: "sobridalsocial-dabcd",
//   storageBucket: "sobridalsocial-dabcd.appspot.com",
//   messagingSenderId: "824611477611",
//   appId: "1:824611477611:web:dac0a698277844e539392e",
//   measurementId: "G-L277WJJVVV",
// };
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
// const messaging = getMessaging(app);

export default function App() {
  return (
    <NavigationContainer>
      <HomeTabs />
    </NavigationContainer>
  );
}
