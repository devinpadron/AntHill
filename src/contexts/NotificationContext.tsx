import React, { createContext, useContext, useEffect, ReactNode } from "react";
import {
	requestNotificationPermissions,
	getFCMToken,
	setupNotificationListeners,
} from "../services/notificationService";

type NotificationContextType = {
	// Add any notification state or methods you want to expose
};

const NotificationContext = createContext<NotificationContextType>({});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
	useEffect(() => {
		const setupNotifications = async () => {
			await requestNotificationPermissions();
			await getFCMToken();
		};

		setupNotifications();
		const unsubscribe = setupNotificationListeners();

		return unsubscribe;
	}, []);

	return (
		<NotificationContext.Provider value={{}}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotification = () => useContext(NotificationContext);
