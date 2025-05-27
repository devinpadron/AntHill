import React, { createContext, useContext, useEffect, ReactNode } from "react";
import {
	requestNotificationPermissions,
	getFCMToken,
	setupNotificationListeners,
	saveTokenToUserProfile,
} from "../services/notificationService";
import { useUser } from "./UserContext";
import messaging from "@react-native-firebase/messaging";

type NotificationContextType = {};

const NotificationContext = createContext<NotificationContextType>({});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
	const { userId, loggedIn } = useUser();

	console.log("NotificationProvider initialized for user:", userId);

	useEffect(() => {
		if (!userId || !loggedIn) {
			console.log("Skipping FCM token setup - user not logged in");
			return;
		}
		const setupNotifications = async () => {
			const status = await requestNotificationPermissions();
			const token = await getFCMToken();

			console.log("FCM Token in NotificationProvider:", token);
			if (status && token) {
				await saveTokenToUserProfile(token, userId);
			} else {
				console.warn("Notification permissions not granted");
			}

			messaging().onTokenRefresh(async (newToken) => {
				if (userId) {
					await saveTokenToUserProfile(newToken, userId);
				} else {
					console.warn("User ID not available for token refresh");
				}
			});
		};

		setupNotifications();
		const unsubscribe = setupNotificationListeners();

		return unsubscribe;
	}, [userId]);

	const value = {};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotification = () => useContext(NotificationContext);
