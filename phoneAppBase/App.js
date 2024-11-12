import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import auth from "@react-native-firebase/auth";
import LoadingScreen from "./src/screens/LoadingScreen";

// Import your screens
import HomeTabs from "./src/routes/HomeTabs";
import AuthStack from "./src/routes/AuthStack";

// This component will handle the conditional rendering based on auth state
const AppNavigator = () => {
	const [loggedIn, setLoggedIn] = useState(true);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const subscriber = auth().onAuthStateChanged(async (user) => {
			if (user) {
				try {
					setLoggedIn(true);
				} catch (error) {
					console.error("Error getting user data:", error);
				}
			} else {
				setLoggedIn(false);
			}
			setIsLoading(false);
		});

		return subscriber;
	}, []);

	// Show a loading screen if we're still checking the authentication state
	if (isLoading) {
		return <LoadingScreen />; // You'll need to create this component
	}

	return (
		<NavigationContainer>
			{loggedIn ? (
				// User is signed in
				<HomeTabs />
			) : (
				// No user is signed in
				<AuthStack />
			)}
		</NavigationContainer>
	);
};

const App = () => {
	return <AppNavigator />;
};

export default App;
