import React from "react";
import { SafeAreaView, FlatList, StyleSheet } from "react-native";
import { useUser } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAvailabilityEvents } from "../../hooks/availability/useAvailabilityEvents";
import { useReminderSettings } from "../../hooks/availability/useReminderSettings";
import { useAdminWorkerDetails } from "../../hooks/availability/useAdminWorkerDetails";
import { AppHeader } from "../../components/ui/AppHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { AvailabilityTabBar } from "../../components/availability/AvailabilityTabBar";
import { EventCard } from "../../components/availability/EventCard";
import { ReminderSettingsModal } from "../../components/availability/ReminderSettingsModal";
import { AdminWorkerModal } from "../../components/availability/AdminWorkerModal";
import { Spacing } from "../../constants/tokens";

const AvailabilityPage = ({ navigation }) => {
	const { userId, companyId, isAdmin } = useUser();
	const { theme } = useTheme();

	// Event fetching, filtering, and status management
	const {
		activeTab,
		setActiveTab,
		loading,
		getFilteredEvents,
		updateEventStatus,
		handleUndecline,
		refetch,
	} = useAvailabilityEvents(companyId, userId);

	// Reminder settings modal state and logic
	const {
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
	} = useReminderSettings(companyId);

	// Admin worker details modal state and logic
	const {
		adminModalVisible,
		selectedEventForAdmin,
		eventWorkerDetails,
		loadingWorkerDetails,
		handleAdminEventPress,
		handleAdminStatusChange,
		closeAdminModal,
	} = useAdminWorkerDetails(companyId, refetch);

	const renderEventCard = ({ item }) => (
		<EventCard
			event={item}
			activeTab={activeTab}
			onConfirm={() => updateEventStatus(item.id, true)}
			onDecline={() => updateEventStatus(item.id, false)}
			onUndecline={() => handleUndecline(item.id)}
			onPress={isAdmin ? () => handleAdminEventPress(item) : undefined}
		/>
	);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: theme.Background }]}
		>
			<AppHeader
				title="Availability"
				showBackButton={false}
				onAction={isAdmin ? openReminderSettings : undefined}
				actionIcon="notifications-outline"
				canPerformAction={isAdmin}
			/>

			<AvailabilityTabBar
				activeTab={activeTab}
				onTabChange={setActiveTab}
			/>

			{loading ? (
				<LoadingScreen message="Loading events..." />
			) : (
				<FlatList
					data={getFilteredEvents()}
					renderItem={renderEventCard}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.eventList}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={
						<EmptyState
							icon="calendar-outline"
							title="No Events Found"
							message={`No ${activeTab} events to display at this time`}
						/>
					}
				/>
			)}

			<ReminderSettingsModal
				visible={reminderModalVisible}
				onClose={closeReminderModal}
				onSave={saveReminderSettings}
				reminderHours={reminderHours}
				setReminderHours={setReminderHours}
				reminderMinutes={reminderMinutes}
				setReminderMinutes={setReminderMinutes}
				remindersEnabled={remindersEnabled}
				setRemindersEnabled={setRemindersEnabled}
			/>

			<AdminWorkerModal
				visible={adminModalVisible}
				onClose={closeAdminModal}
				selectedEvent={selectedEventForAdmin}
				workerDetails={eventWorkerDetails}
				loading={loadingWorkerDetails}
				onStatusChange={handleAdminStatusChange}
				onOpenEvent={() => {
					closeAdminModal();
					navigation.navigate("EventDetails", {
						eventId: selectedEventForAdmin.id,
					});
				}}
			/>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	eventList: {
		paddingHorizontal: Spacing.lg,
		paddingBottom: Spacing.xl,
	},
});

export default AvailabilityPage;
