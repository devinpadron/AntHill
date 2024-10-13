import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { UserProvider, useUser } from './src/data/context/UserContext';
import AuthStack from './src/routes/AuthStack';
import HomeTabs from "./src/routes/HomeTabs";

function AppNavigator() {
  const { isLoggedIn } = useUser(); 
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