import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { stackScreenOptions } from "./stackOptions";
import LoginPage from "../screens/auth/LoginPage";
import SignUpPage from "../screens/auth/SignUpPage";

/*
 * Auth stack.
 *
 * Route names match production ("Login", "Sign Up") so nothing that navigates
 * by name has to change at cutover.
 */

const Stack = createNativeStackNavigator();

const AuthStack = () => (
	<Stack.Navigator screenOptions={stackScreenOptions}>
		{/* Swiping back off Login has nowhere to go. */}
		<Stack.Screen
			name="Login"
			component={LoginPage}
			options={{ gestureEnabled: false }}
		/>
		{/* Sign Up was the one route in the app with a native header; it draws
		    its own now, like every other screen. */}
		<Stack.Screen name="Sign Up" component={SignUpPage} />
	</Stack.Navigator>
);

export default AuthStack;
