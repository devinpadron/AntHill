import React, { useCallback, useRef } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "react-native-gesture-handler";

// Hooks
import { useEventDetails } from "../../hooks/useEventDetails";
import { useEventPackages } from "../../hooks/useEventPackages";
import { useEventLabel } from "../../hooks/useEventLabel";
import { useLocationMarkers } from "../../hooks/useLocationMarkers";
import { useUserNotes } from "../../hooks/useUserNotes";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useTheme } from "../../contexts/ThemeContext";

// Components
import LoadingScreen from "../LoadingScreen";
import {
	EventHeader,
	DateTimeCard,
	WorkersNotesCard,
	PackagesCard,
	LocationCard,
	AttachmentsCard,
	UserNotesCard,
	FloatingChecklistButton,
} from "../../components/eventDetails";
import { Badge } from "../../components/ui/Badge";
import { Spacing, Shadow } from "../../constants/tokens";

// Types
type RootStackParamList = {
	EventDetails: { eventId: string };
};

type EventDetailsRouteProp = RouteProp<RootStackParamList, "EventDetails">;

const EventDetails = ({ navigation }) => {
	const { theme, mode } = useTheme();
	const insets = useSafeAreaInsets();
	const route = useRoute<EventDetailsRouteProp>();
	if (!route.params) return null;

	const eventId = route.params.eventId;
	const scrollViewRef = useRef(null);
	const { settings, companyId, isAdmin } = useUser();
	const prefMap = settings?.preferredMapApp || "";
	const { preferences } = useCompany();

	// Data hooks
	const {
		event,
		attachments,
		workerList,
		localNotes,
		setLocalNotes,
		isLoading,
		saveNotes,
		hasEditPermission,
		setRefreshKey,
	} = useEventDetails(eventId);

	const { packages, loadingPackages, totalChecklists } = useEventPackages(
		event?.packages,
		companyId,
	);
	const { eventLabel } = useEventLabel(event?.labelId, companyId);
	const { markers, initialRegion } = useLocationMarkers(event?.locations);
	const { isEditingNotes, animatedOpacity, handleDoubleTap, handleBlur } =
		useUserNotes(saveNotes);

	// Refresh data when screen comes into focus
	useFocusEffect(
		useCallback(() => {
			setRefreshKey((prevKey) => prevKey + 1);
		}, [eventId]),
	);

	// Navigation handlers
	const handleEdit = () => {
		navigation.navigate("EditEvent", { uid: eventId });
	};

	const handleNavigateChecklists = (
		checklistIds: string[],
		evtId: string,
	) => {
		navigation.navigate("EventChecklists", {
			checklistIds,
			eventId: evtId,
		});
	};

	if (isLoading || !event || loadingPackages) {
		return <LoadingScreen />;
	}

	const showLabel = (preferences.canViewEventLabels || isAdmin) && eventLabel;

	return (
		<View
			style={[
				styles.container,
				{ paddingTop: insets.top, backgroundColor: theme.Background },
			]}
		>
			<StatusBar
				barStyle={mode === "dark" ? "light-content" : "dark-content"}
			/>

			<ScrollView
				ref={scrollViewRef}
				contentContainerStyle={styles.scrollContent}
				automaticallyAdjustKeyboardInsets
				showsVerticalScrollIndicator={false}
			>
				<EventHeader
					title={event.title}
					onBack={() => navigation.goBack()}
					onEdit={handleEdit}
					canEdit={hasEditPermission}
				/>

				{showLabel && (
					<View style={styles.labelContainer}>
						<Badge
							variant="primary"
							size="lg"
							style={[
								{ backgroundColor: eventLabel.color },
								Shadow.sm,
							]}
						>
							{eventLabel.name}
						</Badge>
					</View>
				)}

				<DateTimeCard
					date={event.date}
					startTime={event.startTime}
					endTime={event.endTime}
					duration={event.duration}
				/>

				<WorkersNotesCard
					assignedWorkers={event.assignedWorkers}
					workerList={workerList}
					notes={event.notes}
				/>

				<PackagesCard
					packages={packages}
					totalChecklists={totalChecklists}
					eventId={eventId}
					onNavigateChecklists={handleNavigateChecklists}
				/>

				<LocationCard
					markers={markers}
					initialRegion={initialRegion}
					preferredMapApp={prefMap}
				/>

				<AttachmentsCard attachments={attachments} />

				<UserNotesCard
					localNotes={localNotes}
					setLocalNotes={setLocalNotes}
					isEditingNotes={isEditingNotes}
					animatedOpacity={animatedOpacity}
					handleDoubleTap={handleDoubleTap}
					handleBlur={handleBlur}
				/>

				<View style={styles.bottomSpace} />
			</ScrollView>

			<FloatingChecklistButton
				packages={packages}
				eventId={eventId}
				onNavigate={handleNavigateChecklists}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollContent: {
		padding: Spacing.lg,
		paddingBottom: 80,
	},
	labelContainer: {
		marginBottom: Spacing.md,
		paddingTop: Spacing.sm,
		paddingHorizontal: Spacing.xs,
		alignItems: "center",
		justifyContent: "center",
	},
	bottomSpace: {
		height: 40,
	},
});

export default EventDetails;
