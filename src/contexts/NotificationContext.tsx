import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
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

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
	const { userId, loggedIn, user, companyId } = useUser();
	const [lastNotification, setLastNotification] = useState<any | null>(null);

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
			}
		} catch (error) {
			console.error("Navigation error:", error);
		}
	};

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

	// Handle notification clicks
	useEffect(() => {
		// Handle notifications that cause the app to open from background state
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

		// Setup foreground notification listener
		const unsubscribeFromForegroundNotifications =
			setupNotificationListeners((remoteMessage) => {
				// This callback will be triggered when a user taps on the in-app notification
				const notificationData: any = remoteMessage.data || {};
				handleNotificationNavigation(notificationData);
			});

		// Check if app was opened from a notification (app was closed)
		messaging()
			.getInitialNotification()
			.then((remoteMessage) => {
				if (remoteMessage) {
					console.log(
						"Notification caused app to open from quit state:",
						remoteMessage,
					);

					// Remove the setTimeout and directly handle navigation
					// The pendingNavigation system will take care of timing
					const notificationData: any = remoteMessage.data || {};
					handleNotificationNavigation(notificationData);
				}
			});

		// Clean up listeners on unmount
		return () => {
			unsubscribeFromBackgroundNotifications();
			unsubscribeFromForegroundNotifications();
		};
	}, [loggedIn, userId]); // Re-run when user auth state changes

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
