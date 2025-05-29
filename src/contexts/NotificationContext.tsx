import React, { createContext, useContext, useEffect, ReactNode } from "react";
import messaging from "@react-native-firebase/messaging";
import { useUser } from "./UserContext";
import {
	requestNotificationPermissions,
	getFCMToken,
	saveTokenToUserProfile,
	setupNotificationListeners,
} from "../services/notificationService";

type NotificationContextType = {};

const NotificationContext = createContext<NotificationContextType>({});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
	const { userId, loggedIn, user, companyId } = useUser();

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
		const unsubscribe = setupNotificationListeners();

		return unsubscribe;
	}, [userId, loggedIn]);

	const value = {};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotification = () => useContext(NotificationContext);
