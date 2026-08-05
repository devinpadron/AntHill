import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginPage from "../../screens/auth/v2/LoginPage";
import SignUpPage from "../../screens/auth/v2/SignUpPage";

/*
 * Auth stack.
 *
 * Route names match production ("Login", "Sign Up") so nothing that navigates
 * by name has to change at cutover.
 */

const Stack = createNativeStackNavigator();

const AuthStack = () => (
	<Stack.Navigator>
		<Stack.Screen
			name="Login"
			component={LoginPage}
			options={{ headerShown: false, gestureEnabled: false }}
		/>
		<Stack.Screen
			name="Sign Up"
			component={SignUpPage}
			options={{ headerShown: true, gestureEnabled: true }}
		/>
	</Stack.Navigator>
);

export default AuthStack;
