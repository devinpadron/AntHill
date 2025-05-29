import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import auth from "@react-native-firebase/auth";
import { Alert } from "react-native";
import {
	subscribeCurrentUser,
	subscribeUserPrivilege,
} from "../services/userService";
import { signOut } from "../services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Role } from "../types";
import messaging from "@react-native-firebase/messaging";
import { clearNotificationToken } from "../services/notificationService";

// Define the shape of our context
type UserContextType = {
	user: any | null;
	userId: string;
	userPrivilege: string;
	isAdmin: boolean | null;
	isLoading: boolean;
	loggedIn: boolean;
	companyId: string | undefined;
	logout: () => Promise<void>;
	initializing: boolean;
};

// Create the context with a default value
const UserContext = createContext<UserContextType>({
	user: null,
	userId: "",
	userPrivilege: "",
	isAdmin: null,
	isLoading: true,
	loggedIn: false,
	companyId: undefined,
	logout: async () => {},
	initializing: true,
});

// Provider component
export const UserProvider = ({ children }: { children: ReactNode }) => {
	const [user, setUser] = useState<any | null>(null);
	const [userId, setUserId] = useState("");
	const [userPrivilege, setUserPrivilege] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [loggedIn, setLoggedIn] = useState(false);
	const [hasShownAlert, setHasShownAlert] = useState(false);
	const [initializing, setInitializing] = useState(true);
	const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
	const [companyId, setCompanyId] = useState<string | undefined>(undefined);

	// When auth state changes (user logged in)
	const storeAuthState = async () => {
		try {
			await AsyncStorage.setItem("AUTH_STATE", "true");
		} catch (e) {
			console.error("Failed to save auth state");
		}
	};

	// When logging out
	const clearAuthState = async () => {
		try {
			await AsyncStorage.removeItem("AUTH_STATE");
		} catch (e) {
			console.error("Failed to clear auth state");
		}
	};

	// Check on app launch
	useEffect(() => {
		const checkInitialAuth = async () => {
			try {
				const authState = await AsyncStorage.getItem("AUTH_STATE");
				if (authState === "true") {
					// Show loading/home screen immediately
					setLoggedIn(true);
				}
				setInitializing(false);
			} catch (e) {
				setInitializing(false);
			}
		};

		checkInitialAuth();
	}, []);

	// Verify email alert helper
	const showVerificationAlert = () => {
		if (!hasShownAlert) {
			setHasShownAlert(true);
			Alert.alert(
				"Please verify your email",
				"Check your account email to complete verification and login.",
				[
					{
						text: "Resend Email",
						onPress: async () => {
							try {
								const user = auth().currentUser;
								if (user) {
									await user.sendEmailVerification();
									Alert.alert(
										"Success",
										"Verification email sent!",
									);
								}
							} catch (error) {
								console.error(
									"Error sending verification email:",
									error,
								);
								Alert.alert(
									"Failed to send verification email. Please try again.",
									error.message,
								);
							}
							signOut();
						},
					},
					{
						text: "OK",
						onPress: () => signOut(),
					},
				],
			);
		}
	};

	// Handle auth state changes
	useEffect(() => {
		setIsLoading(true); // Always start with loading true when auth state changes

		const authSubscriber = auth().onAuthStateChanged(async (authUser) => {
			try {
				if (authUser) {
					await authUser.reload();
					const refreshedUser = auth().currentUser;

					if (refreshedUser?.emailVerified) {
						setHasShownAlert(false);
						setLoggedIn(true);
						storeAuthState();
						// Don't set isLoading false here - wait for user data
					} else {
						setLoggedIn(false);
						showVerificationAlert();
						clearAuthState();
						setIsLoading(false); // Can set false here - we know we need to show login
					}
				} else {
					// No user, definitely show login
					setHasShownAlert(false);
					setLoggedIn(false);
					setUser(null);
					setUserId("");
					setUserPrivilege("");
					clearAuthState();
					setIsLoading(false);
				}
			} catch (error) {
				console.error("Error in auth state change:", error);
				setLoggedIn(false);
				clearAuthState();
				setIsLoading(false);
			}
		});

		return authSubscriber;
	}, []);

	// Subscribe to current user data when logged in
	useEffect(() => {
		let userSubscriber = () => {};

		if (loggedIn) {
			userSubscriber = subscribeCurrentUser(async (userSnapshot) => {
				try {
					if (!userSnapshot.exists) {
						setIsLoading(false);
						return;
					}

					// Get user data
					const userData = userSnapshot.data();
					setUser(userData);
					setUserId(userSnapshot.id);
					setCompanyId(userData.loggedInCompany);

					setIsLoading(false);
				} catch (error) {
					console.error("Error loading user data:", error);
					setIsLoading(false);
				}
			});
		} else {
			setIsLoading(false);
		}

		return userSubscriber;
	}, [loggedIn]);

	useEffect(() => {
		const privSubscriber = subscribeUserPrivilege(
			userId,
			companyId,
			async (userPrivilegeSnapshot) => {
				if (userPrivilegeSnapshot.exists) {
					const privilege = userPrivilegeSnapshot.data().role;
					setUserPrivilege(privilege);
					setIsAdmin(
						privilege === Role.MANAGER || privilege === Role.OWNER,
					);
				}
			},
		);
		privSubscriber;
	}, [user, userId, companyId]);

	const logout = async () => {
		console.log("Logging out user:", userId);
		try {
			// Get FCM token
			const token = await messaging().getToken();

			// Clear FCM token and unsubscribe from topics
			if (token && userId) {
				console.log("Clearing FCM token:", token);
				await clearNotificationToken(userId, token);

				await messaging().deleteToken();
			}

			// Continue with logout process
			await auth().signOut();
			// Reset any other state as needed
		} catch (error) {
			console.error("Error during logout:", error);
		}
	};

	// Create the context value object
	const value = {
		user,
		userId,
		userPrivilege,
		isAdmin,
		isLoading,
		loggedIn,
		companyId,
		logout,
		initializing,
	};

	console.log("UserContext initialized with user:", userId);

	return (
		<UserContext.Provider value={value}>{children}</UserContext.Provider>
	);
};

// Create a custom hook for consuming the context
export const useUser = () => useContext(UserContext);
