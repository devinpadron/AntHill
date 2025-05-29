import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import HomeTabs from "../navigation/HomeTabs";
import AuthStack from "../navigation/AuthStack";
import SplashScreen from "../screens/SplashScreen";
import { useUser } from "../contexts/UserContext";

export const AppNavigator = () => {
	const { loggedIn, initializing } = useUser();

	if (initializing) {
		return <SplashScreen />;
	}

	return <>{loggedIn ? <HomeTabs /> : <AuthStack />}</>;
};
