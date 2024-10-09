import React from "react";
import { NavigationContainer } from "@react-navigation/native";

//Navigation Control
import HomeTabs from "./src/routes/HomeTabs";
import AuthStack from "./src/routes/AuthStack";

export default function App() {
  return (
    <NavigationContainer>
      <AuthStack />
    </NavigationContainer>
  );
}
