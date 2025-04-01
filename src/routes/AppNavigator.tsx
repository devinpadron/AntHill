import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import HomeTabs from "../routes/HomeTabs";
import AuthStack from "../routes/AuthStack";
import LoadingScreen from "../screens/LoadingScreen";
import SplashScreen from "../screens/SplashScreen";
import { useUser } from "../contexts/UserContext";

export const AppNavigator = () => {
	const { loggedIn, initializing } = useUser();

	if (initializing) {
		return <SplashScreen />;
	}

	return (
		<NavigationContainer>
			{loggedIn ? <HomeTabs /> : <AuthStack />}
		</NavigationContainer>
	);
};
