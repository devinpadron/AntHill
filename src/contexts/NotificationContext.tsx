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
	subscribeToTopics,
	unsubscribeFromTopics,
} from "../services/notificationService";
import { getUserPrivilege } from "../services/userService";

type NotificationContextType = {
	subscribedTopics: string[];
};

const NotificationContext = createContext<NotificationContextType>({
	subscribedTopics: [],
});

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
	const { userId, loggedIn, user, companyId } = useUser();
	const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);

	// Handle topic subscriptions when user data changes
	useEffect(() => {
		if (!userId || !loggedIn || !user) {
			return;
		}

		const manageTopicSubscriptions = async () => {
			try {
				// Get user's companies - should be an array of company IDs
				const userCompanyIds = user.companies || [];
				const currentTopics: string[] = [];

				// Process each company ID to get privileges
				const companyPrivilegePromises = userCompanyIds.map(
					async (companyId) => {
						// First add the company-wide topic
						const companyTopic = `company_${companyId}`;
						currentTopics.push(companyTopic);

						// Then get the user's role/privilege for this company
						const privilege = await getUserPrivilege(
							userId,
							companyId,
						);

						if (privilege) {
							const privilegeTopic = `company_${companyId}_${privilege}`;
							currentTopics.push(privilegeTopic);
						}
					},
				);

				// Wait for all privilege lookups to complete
				await Promise.all(companyPrivilegePromises);

				// Handle global admin status if applicable
				if (user.isAdmin) {
					currentTopics.push("global_admins");
				}

				console.log("Current notification topics:", currentTopics);

				// Find topics to unsubscribe from (old topics not in current list)
				const topicsToUnsubscribe = subscribedTopics.filter(
					(topic) => !currentTopics.includes(topic),
				);

				// Find new topics to subscribe to
				const topicsToSubscribe = currentTopics.filter(
					(topic) => !subscribedTopics.includes(topic),
				);

				// Perform unsubscribe operations
				if (topicsToUnsubscribe.length > 0) {
					console.log(
						"Unsubscribing from topics:",
						topicsToUnsubscribe,
					);
					await unsubscribeFromTopics(topicsToUnsubscribe);
				}

				// Perform subscribe operations
				if (topicsToSubscribe.length > 0) {
					console.log("Subscribing to topics:", topicsToSubscribe);
					await subscribeToTopics(topicsToSubscribe);
				}

				// Update state with current topics
				setSubscribedTopics(currentTopics);
			} catch (error) {
				console.error("Error managing topic subscriptions:", error);
			}
		};

		manageTopicSubscriptions();
	}, [userId, user, loggedIn]);

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

	const value = {
		subscribedTopics,
	};

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
};

export const useNotification = () => useContext(NotificationContext);
