import "react-native-get-random-values";
import React, { useState, useEffect, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import auth from "@react-native-firebase/auth";
import LoadingScreen from "./src/screens/LoadingScreen";

// Import your screens
import HomeTabs from "./src/routes/HomeTabs";
import AuthStack from "./src/routes/AuthStack";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { signOut } from "./src/controllers/authController";

// This component will handle the conditional rendering based on auth state
const AppNavigator = () => {
	const [loggedIn, setLoggedIn] = useState(true);
	const [isLoading, setIsLoading] = useState(true);
	const hasShownAlert = useRef(false);

	useEffect(() => {
		const showVerificationAlert = () => {
			if (!hasShownAlert.current) {
				hasShownAlert.current = true;
				Alert.alert(
					"Please verify your email",
					"Check your account email in-order to complete verification and login.",
					[
						{
							text: "Resend Email",
							onPress: async () => {
								try {
									const user = currentUser;
									if (user) {
										await user.sendEmailVerification();
										Alert.alert(
											"Success",
											"Verification email sent!"
										);
									}
								} catch (error) {
									console.error(
										"Error sending verification email:",
										error
									);
									Alert.alert(
										"Error",
										"Failed to send verification email. Please try again."
									);
								}
								signOut();
							},
						},
						{
							text: "OK",
							onPress: () => {
								// Optionally sign out the user if they haven't verified their email
								signOut();
							},
						},
					]
				);
			}
		};

		const subscriber = auth().onAuthStateChanged(async (user) => {
			try {
				if (user) {
					// Reload the user to get the latest email verification status
					await user.reload();
					const refreshedUser = auth().currentUser;

					if (refreshedUser?.emailVerified) {
						hasShownAlert.current = false; // Reset for next session
						setLoggedIn(true);
					} else {
						setLoggedIn(false);
						showVerificationAlert();
					}
				} else {
					hasShownAlert.current = false; // Reset for next session
					setLoggedIn(false);
				}
			} catch (error) {
				console.error("Error in auth state change:", error);
				setLoggedIn(false);
			} finally {
				setIsLoading(false);
			}
		});

		// Cleanup subscription
		return () => {
			subscriber();
			hasShownAlert.current = false;
		};
	}, []);

	// Show a loading screen if we're still checking the authentication state
	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<NavigationContainer>
				{loggedIn ? (
					// User is signed in
					<HomeTabs />
				) : (
					// No user is signed in
					<AuthStack />
				)}
			</NavigationContainer>
		</GestureHandlerRootView>
	);
};

const App = () => {
	return <AppNavigator />;
};

export default App;
