import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
	useRef,
} from "react";
import messaging from "@react-native-firebase/messaging";
import { useUser } from "./UserContext";
import {
	requestNotificationPermissions,
	getFCMToken,
	saveTokenToUserProfile,
	setupNotificationListeners,
} from "../services/notificationService";
import { swapUserCompany } from "../services/userService";
import { pendingNavigation } from "../navigation/navigationRef";

type NotificationContextType = {
	lastNotification: any | null;
	handleNotificationNavigation: (data: any) => void;
};

// Create the context with default values
const NotificationContext = createContext<NotificationContextType>({
	lastNotification: null,
	handleNotificationNavigation: () => {},
});

const parseIdsToArray = (idString: string): string[] => {
	// If the string contains commas, split it into an array
	if (idString && idString.includes(",")) {
		return idString.split(",").map((id) => id.trim());
	}
	// Otherwise return it as a single-item array
	return [idString];
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
	const { userId, loggedIn, user, companyId } = useUser();
	const [lastNotification, setLastNotification] = useState<any | null>(null);

	// Add a ref to store initial notification data
	const initialNotificationRef = useRef<any>(null);
	const initialNotificationChecked = useRef(false);

	// Updated navigation handler function
	const handleNotificationNavigation = async (data: any) => {
		console.log("Handling notification navigation:", data);

		if (!data) {
			console.log("Cannot navigate: missing data");
			return;
		}

		// Store the last notification data
		setLastNotification(data);

		try {
			// Navigate based on notification type
			switch (data.type) {
				case "user_left":
				case "new_user_joined":
					if (data.screenName && data.companyId) {
						await swapUserCompany(userId, data.companyId);
						// Use pendingNavigation.setAction instead of direct navigation
						pendingNavigation.setAction(data.screenName);
					}
					break;

				case "update":
				case "assignment":
					if (data.screenName && data.eventId && data.companyId) {
						await swapUserCompany(userId, data.companyId);
						pendingNavigation.setAction(data.screenName, {
							eventId: data.eventId,
						});
					}
					break;

				case "timesheet_approval":
				case "timesheet_rejection":
					if (data.screenName && data.timesheetId && data.companyId) {
						await swapUserCompany(userId, data.companyId);
						pendingNavigation.setAction(data.screenName, {
							entryId: data.timesheetId,
							userId: data.userId,
						});
					}
					break;

				case "timesheet_approval_batch":
				case "timesheet_rejection_batch":
					if (data.screenName && data.timesheetId && data.companyId) {
						await swapUserCompany(userId, data.companyId);
						pendingNavigation.setAction(data.screenName, {
							entryId: parseIdsToArray(data.timesheetId),
							userId: data.userId,
						});
					}
					break;
			}
		} catch (error) {
			console.error("Navigation error:", error);
		}
	};

	// First effect - check for initial notification immediately on mount
	// This runs before auth is ready but captures the notification
	useEffect(() => {
		// Only check once
		if (initialNotificationChecked.current) return;

		initialNotificationChecked.current = true;

		// Check if app was opened from a notification (app was closed)
		messaging()
			.getInitialNotification()
			.then((remoteMessage) => {
				if (remoteMessage) {
					console.log(
						"Captured initial notification from quit state:",
						remoteMessage,
					);

					// Store notification data in ref for later processing
					initialNotificationRef.current = remoteMessage.data || {};
				}
			});
	}, []); // Empty dependency array - run only once on mount

	// Second effect - process initial notification when auth is ready
	useEffect(() => {
		// Wait until user is authenticated
		if (!userId || !loggedIn) return;

		// Process stored initial notification if we have one
		if (initialNotificationRef.current) {
			console.log(
				"Processing stored initial notification now that auth is ready:",
				initialNotificationRef.current,
			);

			handleNotificationNavigation(initialNotificationRef.current);
			initialNotificationRef.current = null; // Clear after processing
		}
	}, [userId, loggedIn]); // Run when auth state changes

	// Setup FCM token and listeners
	useEffect(() => {
		if (!userId || !loggedIn) {
			return;
		}

		const setupNotifications = async () => {
			try {
				const enabled = await requestNotificationPermissions();

				if (!enabled) {
					console.log("User notification permissions denied");
					return;
				}

				const token = await getFCMToken();

				if (userId) {
					await saveTokenToUserProfile(token, userId);
				}

				messaging().onTokenRefresh(async (newToken) => {
					if (userId) {
						await saveTokenToUserProfile(newToken, userId);
					}
				});
			} catch (error) {
				console.error("Error setting up notifications:", error);
			}
		};

		setupNotifications();
	}, [userId, loggedIn]);

	// Handle notification clicks for background/foreground states
	useEffect(() => {
		// Background notification handler
		const unsubscribeFromBackgroundNotifications =
			messaging().onNotificationOpenedApp((remoteMessage) => {
				console.log(
					"Notification caused app to open from background state:",
					remoteMessage,
				);

				// Extract and process notification data
				const notificationData: any = remoteMessage.data || {};
				handleNotificationNavigation(notificationData);
			});

		// Foreground notification handler
		const unsubscribeFromForegroundNotifications =
			setupNotificationListeners((remoteMessage) => {
				// This callback will be triggered when a user taps on the in-app notification
				const notificationData: any = remoteMessage.data || {};
				handleNotificationNavigation(notificationData);
			});

		// Clean up listeners on unmount
		return () => {
			unsubscribeFromBackgroundNotifications();
			unsubscribeFromForegroundNotifications();
		};
	}, [loggedIn, userId]);

	const value = {
		lastNotification,
		handleNotificationNavigation,
	};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotification = () => useContext(NotificationContext);
