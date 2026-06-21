import React from "react";
import RootStack from "../navigation/RootStack";
import AuthStack from "../navigation/AuthStack";
import SplashScreen from "../screens/SplashScreen";
import { useUser } from "../contexts/UserContext";

export const AppNavigator = () => {
	const { loggedIn, initializing } = useUser();

	if (initializing) {
		return <SplashScreen />;
	}

	return loggedIn ? <RootStack /> : <AuthStack />;
};
