import { useState, useCallback } from "react";
import { Alert } from "react-native";
import {
	updateCompanyPreferences,
	getCompanyPreferences,
} from "../../services/companyService";

/**
 * useReminderSettings
 *
 * Manages all state and logic for the availability reminder settings modal.
 * Handles fetching current preferences, local edits, and saving back to Firebase.
 */
export const useReminderSettings = (companyId: string) => {
	const [reminderModalVisible, setReminderModalVisible] = useState(false);
	const [reminderHours, setReminderHours] = useState("24");
	const [reminderMinutes, setReminderMinutes] = useState("0");
	const [remindersEnabled, setRemindersEnabled] = useState(true);

	const openReminderSettings = useCallback(async () => {
		try {
			// Fetch current company preferences
			const preferences = await getCompanyPreferences(companyId);

			// Set current values
			const currentHours = preferences?.availabilityReminderHours || 24;
			const currentMinutes =
				preferences?.availabilityReminderMinutes || 0;
			const currentEnabled =
				preferences?.availabilityReminderEnabled !== false; // Default to true if undefined

			setReminderHours(currentHours.toString());
			setReminderMinutes(currentMinutes.toString());
			setRemindersEnabled(currentEnabled);
			setReminderModalVisible(true);
		} catch (error) {
			console.error("Error fetching reminder preferences:", error);
		}
	}, [companyId]);

	const saveReminderSettings = useCallback(async () => {
		try {
			const hours = parseInt(reminderHours) || 24;
			const minutes = parseInt(reminderMinutes) || 0;

			await updateCompanyPreferences(companyId, {
				availabilityReminderHours: hours,
				availabilityReminderMinutes: minutes,
				availabilityReminderEnabled: remindersEnabled,
			});

			setReminderModalVisible(false);
			Alert.alert("Success", "Reminder settings updated successfully!");
		} catch (error) {
			console.error("Error saving reminder preferences:", error);
			Alert.alert("Error", "Failed to save reminder settings");
		}
	}, [companyId, reminderHours, reminderMinutes, remindersEnabled]);

	const closeReminderModal = useCallback(() => {
		setReminderModalVisible(false);
	}, []);

	return {
		reminderModalVisible,
		reminderHours,
		setReminderHours,
		reminderMinutes,
		setReminderMinutes,
		remindersEnabled,
		setRemindersEnabled,
		openReminderSettings,
		saveReminderSettings,
		closeReminderModal,
	};
};
