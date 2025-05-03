import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Animated,
	TouchableOpacity,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import LoadingScreen from "../LoadingScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import moment from "moment";
import MapView, { Marker } from "react-native-maps";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

// Custom hooks and utilities
import { useEventDetails } from "../../hooks/useEventDetails";
import { getRegionForMarkers, openMap, MapMarker } from "../../utils/mapUtils";

// Components
import { EventHeader } from "../../components/eventDetails/EventHeader";
import { AttachmentGallery } from "../../components/eventDetails/AttachmentGallery";

// Types
type RootStackParamList = {
	EventDetails: { uid: string };
};

type EventDetailsRouteProp = RouteProp<RootStackParamList, "EventDetails">;

const EventDetails = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const route = useRoute<EventDetailsRouteProp>();
	if (!route.params) return null;

	const eventId = route.params.uid;
	const [markers, setMarkers] = useState<MapMarker[]>([]);
	const [initialRegion, setInitialRegion] = useState(null);
	const scrollViewRef = useRef(null);
	const [isEditingNotes, setIsEditingNotes] = useState(false);
	const [lastTapTime, setLastTapTime] = useState(0);

	const animatedOpacity = useRef(new Animated.Value(0)).current;

	// Use custom hook for event data
	const {
		user,
		event,
		workerList,
		localNotes,
		setLocalNotes,
		isLoading,
		attachments,
		saveNotes,
		hasEditPermission,
	} = useEventDetails(eventId);

	const handleDoubleTap = () => {
		const now = Date.now();
		const DOUBLE_TAP_DELAY = 300; // ms between taps

		if (now - lastTapTime < DOUBLE_TAP_DELAY) {
			// Double tap detected
			setIsEditingNotes(true);

			// Show animation feedback
			Animated.sequence([
				Animated.timing(animatedOpacity, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}),
				Animated.timing(animatedOpacity, {
					toValue: 0.5,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start();

			// Reset tap timer
			setLastTapTime(0);
		} else {
			// First tap - start timer
			setLastTapTime(now);
		}
	};

	const handleBlur = () => {
		saveNotes();
		setIsEditingNotes(false);
	};

	// Process location data
	useEffect(() => {
		if (!event?.locations) return;

		const locationMarkers: MapMarker[] = [];

		for (let location in event.locations) {
			locationMarkers.push({
				latitude: event.locations[location].latitude,
				longitude: event.locations[location].longitude,
				title: location,
				label: event.locations[location].label,
			});
		}

		setMarkers(locationMarkers);
	}, [event]);

	// Calculate map region when markers change
	useEffect(() => {
		if (markers.length > 0) {
			setInitialRegion(getRegionForMarkers(markers));
		}
	}, [markers]);

	// Handle edit navigation
	const handleEdit = () => {
		navigation.navigate("EditEvent", { uid: eventId });
	};

	if (isLoading || !event) {
		return <LoadingScreen />;
	}

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<KeyboardAwareScrollView
				ref={scrollViewRef}
				contentContainerStyle={{ flexGrow: 1 }}
				extraScrollHeight={100}
			>
				<EventHeader
					title={event.title}
					onBack={() => navigation.goBack()}
					onEdit={handleEdit}
					canEdit={hasEditPermission}
				/>

				<View style={styles.content}>
					{/* Event Date */}
					<View style={[styles.timeSection, { marginBottom: 10 }]}>
						<Text style={styles.timeText}>
							{moment(event.date).format("dddd, MMMM D, YYYY")}
						</Text>
					</View>

					{/* Event Time */}
					<View style={styles.timeSection}>
						{event.startTime ? (
							<>
								<Text style={styles.timeText}>
									{moment(event.startTime, "HH:mm").format(
										"h:mma",
									)}
								</Text>

								{event.endTime && (
									<>
										<Text style={styles.timeText}>-</Text>
										<Text style={styles.timeText}>
											{moment(
												event.endTime,
												"HH:mm",
											).format("h:mma")}
										</Text>
									</>
								)}
							</>
						) : (
							<Text style={styles.timeText}>All Day</Text>
						)}
					</View>

					{/* Event Duration */}
					<View style={styles.duration}>
						{event.duration && (
							<Text style={{ fontSize: 18 }}>
								{event.duration} hours
							</Text>
						)}
					</View>

					<View style={styles.detailsSection}>
						{/* Workers Section */}
						{event.assignedWorkers?.length > 0 && (
							<>
								<Text style={styles.label}>
									Assigned Workers
								</Text>
								<Text style={styles.text}>{workerList}</Text>
							</>
						)}

						{/* Notes Section */}
						{event.notes && (
							<>
								<Text style={styles.label}>Notes</Text>
								<Text style={styles.text}>{event.notes}</Text>
							</>
						)}

						{/* Map Section */}
						{markers.length > 0 && initialRegion && (
							<MapView style={styles.map} region={initialRegion}>
								{markers.map((marker, index) => (
									<Marker
										key={index}
										coordinate={{
											latitude: marker.latitude,
											longitude: marker.longitude,
										}}
										description={
											marker.label ? marker.title : ""
										}
										title={
											marker.label
												? marker.label
												: marker.title
										}
										onCalloutPress={() => openMap(marker)}
									/>
								))}
							</MapView>
						)}
					</View>

					{/* Attachments */}
					<AttachmentGallery attachments={attachments} />

					{/* User Notes */}
					<View>
						<Text style={[styles.label, { marginTop: 10 }]}>
							Your Notes
							<Text style={styles.editHint}>
								{isEditingNotes
									? " (editing)"
									: " (double-tap to unlock)"}
							</Text>
						</Text>

						<TouchableOpacity
							activeOpacity={0.8}
							onPress={
								isEditingNotes ? undefined : handleDoubleTap
							}
							disabled={isEditingNotes}
						>
							<Animated.View
								style={[
									styles.notesContainer,
									isEditingNotes &&
										styles.editingNotesContainer,
									!isEditingNotes && {
										opacity: animatedOpacity.interpolate({
											inputRange: [0, 0.5, 1],
											outputRange: [1, 0.8, 1],
										}),
									},
								]}
							>
								<TextInput
									style={styles.notesInput}
									multiline
									editable={isEditingNotes}
									numberOfLines={5}
									value={localNotes}
									onChangeText={
										isEditingNotes
											? setLocalNotes
											: undefined
									}
									onBlur={
										isEditingNotes ? handleBlur : undefined
									}
									placeholder="Add your personal notes here..."
									contextMenuHidden={!isEditingNotes}
									pointerEvents={
										isEditingNotes ? "auto" : "none"
									}
								/>
							</Animated.View>
						</TouchableOpacity>
					</View>
				</View>
			</KeyboardAwareScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	content: {
		flex: 1,
		padding: 16,
	},
	timeSection: {
		flexDirection: "row",
		justifyContent: "center",
	},
	timeText: {
		fontSize: 20,
		fontWeight: "500",
		paddingHorizontal: 4,
	},
	duration: {
		marginBottom: 16,
		flexDirection: "row",
		justifyContent: "center",
	},
	detailsSection: {
		gap: 12,
	},
	label: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
	},
	text: {
		fontSize: 16,
		lineHeight: 20,
		marginBottom: 12,
	},
	map: {
		height: 300,
		marginBottom: 16,
		borderRadius: 8,
	},
	notesContainer: {
		borderWidth: 1,
		borderColor: "#eee",
		borderRadius: 8,
		marginBottom: 12,
	},

	editingNotesContainer: {
		borderColor: "#007AFF",
		backgroundColor: "#F0F8FF",
	},

	notesInput: {
		fontSize: 16,
		lineHeight: 20,
		padding: 8,
		minHeight: 150,
	},

	editHint: {
		fontSize: 12,
		fontStyle: "italic",
		color: "#999",
		fontWeight: "400",
	},
});

export default EventDetails;
