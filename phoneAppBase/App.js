import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { UserProvider, useUser } from './src/auth/UserContext';

// Import your screens
import HomeTabs from './src/routes/HomeTabs';
import AuthStack from './src/routes/AuthStack';
import { AuthProvider, useAuth } from './src/auth/AuthProvider';

const Stack = createStackNavigator();

// This component will handle the conditional rendering based on auth state
const AppNavigator = () => {
  const { user } = useAuth();

  // Show a loading screen if we're still checking the authentication state
  /*if (initializing) {
    return <LoadingScreen />;  // You'll need to create this component
  }*/

  return (
    <NavigationContainer>
      {user ? (
        // User is signed in
        <HomeTabs/>
      ) : (
        // No user is signed in
          <AuthStack/>
      )}
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <UserProvider>
          <AppNavigator />
      </UserProvider>
    </AuthProvider>
  );
};

export default App;