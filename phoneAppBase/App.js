<<<<<<< HEAD
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { UserProvider, useUser } from './src/contexts/UserContext';
import AuthStack from "./src/routes/authStack";
import HomeTabs from "./src/routes/homeTabs";
import { createTestUser } from 'lodash';


function AppNavigator() {
  const { isLoggedIn } = useUser(); 
  createTestUser();
=======
import React from "react";
import { NavigationContainer } from "@react-navigation/native";

//Navigation Control
import HomeTabs from "./src/routes/HomeTabs";
import AuthStack from "./src/routes/AuthStack";

export default function App() {
>>>>>>> dev
  return (
    <NavigationContainer>
      {isLoggedIn ? <HomeTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

    function App() {
      return (
        <UserProvider>
          <AppNavigator />
        </UserProvider>
      );
    };

export default App;