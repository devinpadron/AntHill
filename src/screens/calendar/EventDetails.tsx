import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Animated,
	TouchableOpacity,
	StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getPackageDetails } from "../../services/packageService";
import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native";
import LoadingScreen from "../LoadingScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import moment from "moment";
import MapView, { Marker } from "react-native-maps";

// Custom hooks and utilities
import { useEventDetails } from "../../hooks/useEventDetails";
import { getRegionForMarkers, openMap, MapMarker } from "../../utils/mapUtils";

// Components
import { EventHeader } from "../../components/eventDetails/EventHeader";
import { ScrollView } from "react-native-gesture-handler";
import AttachmentGallery from "../../components/ui/AttachmentGallery";
import { useUser } from "../../contexts/UserContext";
import db from "../../constants/firestore";
import { useCompany } from "../../contexts/CompanyContext";

// Types
type RootStackParamList = {
	EventDetails: { eventId: string };
};

type EventDetailsRouteProp = RouteProp<RootStackParamList, "EventDetails">;

const EventDetails = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const route = useRoute<EventDetailsRouteProp>();
	if (!route.params) return null;

	const eventId = route.params.eventId;
	const [markers, setMarkers] = useState<MapMarker[]>([]);
	const [initialRegion, setInitialRegion] = useState(null);
	const scrollViewRef = useRef(null);
	const [isEditingNotes, setIsEditingNotes] = useState(false);
	const [lastTapTime, setLastTapTime] = useState(0);
	const { settings } = useUser();
	const prefMap = settings?.preferredMapApp || "";
	const animatedOpacity = useRef(new Animated.Value(0)).current;
	const { preferences } = useCompany();

	// Use custom hook for event data
	const {
		user,
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

	// Add this new effect to refresh data when screen comes into focus
	useFocusEffect(
		React.useCallback(() => {
			setRefreshKey((prevKey) => prevKey + 1);
		}, [eventId]),
	);

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

	// Add state for packages
	const [packages, setPackages] = useState([]);
	const [loadingPackages, setLoadingPackages] = useState(false);
	const { companyId, isAdmin } = useUser();

	// Add effect to load packages
	useEffect(() => {
		if (!event?.packages || !companyId) return;

		const fetchPackages = async () => {
			setLoadingPackages(true);
			try {
				const packagePromises = event.packages.map((packageId) =>
					getPackageDetails(companyId, packageId),
				);
				const packageResults = await Promise.all(packagePromises);
				setPackages(packageResults.filter((pkg) => pkg !== null));
			} catch (error) {
				console.error("Error loading packages:", error);
			} finally {
				setLoadingPackages(false);
			}
		};

		fetchPackages();
	}, [event?.packages, companyId]);

	// First, add a state for the label
	const [eventLabel, setEventLabel] = useState(null);

	// Add this effect to fetch the label data
	useEffect(() => {
		if (!event?.labelId || !companyId) return;

		const fetchLabel = async () => {
			try {
				const labelRef = db
					.collection("Companies")
					.doc(companyId)
					.collection("EventLabels")
					.doc(event.labelId);

				const labelDoc = await labelRef.get();

				if (labelDoc.exists) {
					setEventLabel({
						id: labelDoc.id,
						...labelDoc.data(),
					});
				}
			} catch (error) {
				console.error("Error fetching label:", error);
			}
		};

		fetchLabel();
	}, [event?.labelId, companyId]);

	if (isLoading || !event) {
		return <LoadingScreen />;
	}

	// Count total checklists across all packages
	const totalChecklists = packages.reduce(
		(total, pkg) => total + (pkg.checklists?.length || 0),
		0,
	);

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<StatusBar barStyle="dark-content" />

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

				{/* Event Label */}
				{(preferences.canViewEventLabels || isAdmin) && eventLabel && (
					<View style={styles.labelContainer}>
						<View
							style={[
								styles.labelBadge,
								{ backgroundColor: eventLabel.color },
							]}
						>
							<Text style={styles.labelText}>
								{eventLabel.name}
							</Text>
						</View>
					</View>
				)}

				{/* Date & Time Card */}
				<View style={styles.card}>
					<View style={styles.dateTimeContainer}>
						<View style={styles.dateContainer}>
							<Ionicons
								name="calendar-outline"
								size={20}
								color="#2089dc"
								style={styles.icon}
							/>
							<Text style={styles.dateText}>
								{moment(event.date).format(
									"dddd, MMMM D, YYYY",
								)}
							</Text>
						</View>

						{event.startTime && (
							<View style={styles.timeContainer}>
								<Ionicons
									name="time-outline"
									size={20}
									color="#2089dc"
									style={styles.icon}
								/>
								<View style={styles.timeTextContainer}>
									<Text style={styles.timeText}>
										{moment(
											event.startTime,
											"YYYY-MM-DD HH:mm",
										).format("h:mm A")}
										{event.endTime && (
											<Text style={styles.timeText}>
												{" - "}
												{moment(
													event.endTime,
													"YYYY-MM-DD HH:mm",
												).format("h:mm A")}
											</Text>
										)}
									</Text>
									{event.duration && (
										<Text style={styles.durationText}>
											Duration: {event.duration} hours
										</Text>
									)}
								</View>
							</View>
						)}
					</View>
				</View>

				{/* Workers & Notes Card */}
				{(event.assignedWorkers?.length > 0 || event.notes) && (
					<View style={styles.card}>
						{event.assignedWorkers?.length > 0 && (
							<View style={styles.section}>
								<View style={styles.sectionHeaderContainer}>
									<Ionicons
										name="people-outline"
										size={20}
										color="#2089dc"
										style={styles.icon}
									/>
									<Text style={styles.sectionTitle}>
										Assigned Workers
									</Text>
								</View>
								<Text style={styles.text}>{workerList}</Text>
							</View>
						)}

						{event.notes && (
							<View
								style={[
									styles.section,
									event.assignedWorkers?.length > 0 &&
										styles.sectionDivider,
								]}
							>
								<View style={styles.sectionHeaderContainer}>
									<Ionicons
										name="document-text-outline"
										size={20}
										color="#2089dc"
										style={styles.icon}
									/>
									<Text style={styles.sectionTitle}>
										Event Notes
									</Text>
								</View>
								<Text style={styles.text}>{event.notes}</Text>
							</View>
						)}
					</View>
				)}

				{/* Packages Card */}
				{packages.length > 0 && (
					<View style={styles.card}>
						<View style={styles.sectionHeaderContainer}>
							<Ionicons
								name="cube-outline"
								size={20}
								color="#2089dc"
								style={styles.icon}
							/>
							<Text style={styles.sectionTitle}>
								Packages ({packages.length})
								{totalChecklists > 0 && (
									<Text style={styles.checklistCount}>
										{" · "}
										{totalChecklists} checklists
									</Text>
								)}
							</Text>
						</View>

						{packages.map((pkg, index) => (
							<View
								key={pkg.id}
								style={[
									styles.packageCard,
									index < packages.length - 1 &&
										styles.packageCardMargin,
								]}
							>
								<View style={styles.packageHeader}>
									<Text style={styles.packageTitle}>
										{pkg.title}
									</Text>

									{pkg.checklists &&
										pkg.checklists.length > 0 && (
											<TouchableOpacity
												style={styles.checklistButton}
												onPress={() => {
													const checklistIds =
														pkg.checklists.map(
															(checklist) =>
																typeof checklist ===
																"string"
																	? checklist
																	: checklist.checklistId,
														);
													navigation.navigate(
														"EventChecklists",
														{
															checklistIds,
															eventId,
														},
													);
												}}
											>
												<Ionicons
													name="list"
													size={18}
													color="#2089dc"
												/>
												<Text
													style={
														styles.checklistButtonText
													}
												>
													{pkg.checklists.length}
												</Text>
											</TouchableOpacity>
										)}
								</View>

								{pkg.description ? (
									<Text style={styles.packageDescription}>
										{pkg.description}
									</Text>
								) : null}

								{/* Show first 2 checklists */}
								{pkg.checklists &&
									pkg.checklists.length > 0 && (
										<View style={styles.packageChecklists}>
											{pkg.checklists
												.slice(0, 2)
												.map((checklist) => (
													<View
														key={
															typeof checklist ===
															"string"
																? checklist
																: checklist.checklistId
														}
														style={
															styles.packageChecklistItem
														}
													>
														<Ionicons
															name="checkbox-outline"
															size={16}
															color="#4CAF50"
															style={
																styles.checklistIcon
															}
														/>
														<Text
															style={
																styles.packageChecklistTitle
															}
															numberOfLines={1}
														>
															{checklist.title ||
																"Checklist"}
														</Text>
													</View>
												))}
											{pkg.checklists.length > 2 && (
												<Text
													style={
														styles.moreChecklists
													}
												>
													+{pkg.checklists.length - 2}{" "}
													more
												</Text>
											)}
										</View>
									)}
							</View>
						))}
					</View>
				)}

				{/* Location Card */}
				{markers.length > 0 && initialRegion && (
					<View style={styles.card}>
						<View style={styles.sectionHeaderContainer}>
							<Ionicons
								name="location-outline"
								size={20}
								color="#2089dc"
								style={styles.icon}
							/>
							<Text style={styles.sectionTitle}>Location</Text>
						</View>
						<MapView
							style={styles.map}
							region={initialRegion}
							scrollEnabled={true}
						>
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
									onCalloutPress={() =>
										openMap(marker, prefMap, marker.title)
									}
								/>
							))}
						</MapView>
					</View>
				)}

				{/* Attachments Card */}
				{attachments && attachments.length > 0 && (
					<View style={styles.card}>
						<View style={styles.sectionHeaderContainer}>
							<Ionicons
								name="attach-outline"
								size={20}
								color="#2089dc"
								style={styles.icon}
							/>
							<Text style={styles.sectionTitle}>
								Attachments ({attachments.length})
							</Text>
						</View>
						<AttachmentGallery attachments={attachments} />
					</View>
				)}

				{/* User Notes Card */}
				<View style={styles.card}>
					<View style={styles.sectionHeaderContainer}>
						<Ionicons
							name="create-outline"
							size={20}
							color="#2089dc"
							style={styles.icon}
						/>
						<Text style={styles.sectionTitle}>
							Your Notes
							<Text style={styles.editHint}>
								{isEditingNotes
									? " (editing)"
									: " (double-tap to edit)"}
							</Text>
						</Text>
					</View>

					<TouchableOpacity
						activeOpacity={0.8}
						onPress={isEditingNotes ? undefined : handleDoubleTap}
						disabled={isEditingNotes}
					>
						<Animated.View
							style={[
								styles.notesContainer,
								isEditingNotes && styles.editingNotesContainer,
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
									isEditingNotes ? setLocalNotes : undefined
								}
								onBlur={isEditingNotes ? handleBlur : undefined}
								placeholder="Add your personal notes here..."
								contextMenuHidden={!isEditingNotes}
								pointerEvents={isEditingNotes ? "auto" : "none"}
							/>
						</Animated.View>
					</TouchableOpacity>
				</View>

				{/* Bottom space for floating button */}
				<View style={styles.bottomSpace} />
			</ScrollView>

			{/* Floating Checklist Button */}
			{packages.some(
				(pkg) => pkg.checklists && pkg.checklists.length > 0,
			) && (
				<TouchableOpacity
					style={styles.floatingChecklistButton}
					onPress={() => {
						const checklistIds = Array.from(
							new Set(
								packages
									.flatMap((pkg) =>
										pkg.checklists &&
										pkg.checklists.length > 0
											? pkg.checklists.map((checklist) =>
													typeof checklist ===
													"string"
														? checklist
														: checklist.checklistId,
												)
											: [],
									)
									.filter(Boolean),
							),
						);
						navigation.navigate("EventChecklists", {
							checklistIds,
							eventId,
						});
					}}
				>
					<Ionicons name="checkbox-outline" size={24} color="#fff" />
					<Text style={styles.floatingButtonText}>Checklists</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	scrollContent: {
		padding: 16,
		paddingBottom: 80, // Extra padding for floating button
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 12,
		padding: 16,
		marginBottom: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	dateTimeContainer: {
		flexDirection: "column",
	},
	dateContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	timeContainer: {
		flexDirection: "row",
		alignItems: "flex-start",
	},
	timeTextContainer: {
		flexDirection: "column",
	},
	icon: {
		marginRight: 8,
	},
	dateText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	timeText: {
		fontSize: 17,
		fontWeight: "500",
		color: "#333",
	},
	durationText: {
		fontSize: 14,
		color: "#666",
		marginTop: 4,
	},
	section: {
		marginBottom: 8,
	},
	sectionDivider: {
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
		marginTop: 16,
	},
	sectionHeaderContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: "#333",
	},
	text: {
		fontSize: 16,
		lineHeight: 22,
		color: "#444",
	},
	map: {
		height: 220,
		borderRadius: 8,
		overflow: "hidden",
	},
	packageCard: {
		backgroundColor: "#f9f9f9",
		borderRadius: 10,
		padding: 14,
		borderWidth: 1,
		borderColor: "#eee",
	},
	packageCardMargin: {
		marginBottom: 12,
	},
	packageHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	packageTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		flex: 1,
	},
	packageDescription: {
		fontSize: 14,
		lineHeight: 20,
		color: "#666",
		marginBottom: 10,
	},
	checklistButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#e6f2ff",
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 16,
	},
	checklistButtonText: {
		fontSize: 13,
		fontWeight: "500",
		color: "#2089dc",
		marginLeft: 4,
	},
	checklistCount: {
		fontSize: 15,
		fontWeight: "400",
		color: "#666",
	},
	packageChecklists: {
		marginTop: 10,
		backgroundColor: "#f0f0f0",
		borderRadius: 8,
		padding: 10,
	},
	packageChecklistItem: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 6,
	},
	checklistIcon: {
		marginRight: 8,
	},
	packageChecklistTitle: {
		fontSize: 14,
		color: "#333",
	},
	moreChecklists: {
		fontSize: 13,
		color: "#666",
		marginTop: 4,
		fontStyle: "italic",
	},
	notesContainer: {
		borderWidth: 1,
		borderColor: "#eee",
		borderRadius: 8,
		backgroundColor: "#fff",
	},
	editingNotesContainer: {
		borderColor: "#2089dc",
		backgroundColor: "#f0f8ff",
	},
	notesInput: {
		fontSize: 16,
		lineHeight: 22,
		padding: 12,
		minHeight: 120,
		color: "#444",
	},
	editHint: {
		fontSize: 13,
		fontStyle: "italic",
		color: "#888",
		fontWeight: "400",
		marginLeft: 6,
	},
	floatingChecklistButton: {
		position: "absolute",
		bottom: 20,
		right: 20,
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#2089dc",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 30,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 6,
	},
	floatingButtonText: {
		color: "#fff",
		fontWeight: "600",
		fontSize: 15,
		marginLeft: 8,
	},
	bottomSpace: {
		height: 40,
	},
	labelContainer: {
		marginBottom: 12,
		paddingTop: 8,
		paddingHorizontal: 4,
		alignItems: "center",
		justifyContent: "center",
	},
	labelBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 1,
	},
	labelText: {
		color: "white",
		fontSize: 14,
		fontWeight: "500",
		textShadowColor: "rgba(0, 0, 0, 0.3)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
});

export default EventDetails;
