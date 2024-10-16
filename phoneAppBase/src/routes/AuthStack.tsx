import React from "react"; 
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginPage from '../screens/auth/LoginPage';
import SignUpPage from "../screens/auth/SignUpPage";

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator>
      {/* <Stack.Screen
          name="Initializer"
          component={Initializer}
          options={{ headerShown: false, gestureEnabled: false }}
        /> */}
      <Stack.Screen
        name="Login"
        component={LoginPage}
        options={{ headerShown: false, gestureEnabled: false }}
      ></Stack.Screen>
      <Stack.Screen
        name="Sign Up"
        component={SignUpPage}
        options={{ headerShown: true, gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
};

export default AuthStack;
