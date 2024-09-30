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

export default function App() {
  return (
    <NavigationContainer>
      <HomeTabs />
    </NavigationContainer>
  );
}
