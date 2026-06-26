import React from "react";
import { SafeAreaView, FlatList, StyleSheet } from "react-native";
import { useUser } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useAvailabilityEvents } from "../../hooks/availability/useAvailabilityEvents";
import { AppHeader } from "../../components/ui/AppHeader";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { AvailabilityTabBar } from "../../components/availability/AvailabilityTabBar";
import { EventCard } from "../../components/availability/EventCard";
import { Spacing } from "../../constants/tokens";

const AvailabilityPage = ({ navigation }) => {
	const { userId, companyId } = useUser();
	const { theme } = useTheme();

	// Event fetching, filtering, and status management
	const {
		activeTab,
		setActiveTab,
		loading,
		getFilteredEvents,
		updateEventStatus,
		handleUndecline,
	} = useAvailabilityEvents(companyId, userId);

	const renderEventCard = ({ item }) => (
		<EventCard
			event={item}
			activeTab={activeTab}
			onConfirm={() => updateEventStatus(item.id, true)}
			onDecline={() => updateEventStatus(item.id, false)}
			onUndecline={() => handleUndecline(item.id)}
			onPress={() =>
				navigation.navigate("EventDetails", { eventId: item.id })
			}
		/>
	);

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: theme.Background }]}
		>
			<AppHeader title="Availability" showBackButton={false} />

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
