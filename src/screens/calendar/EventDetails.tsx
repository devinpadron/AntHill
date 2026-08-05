import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	TextInput,
	Animated,
	TouchableOpacity,
	StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RouteProp, useRoute } from "@react-navigation/native";
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
import { useCompany } from "../../contexts/CompanyContext";
import { styles } from "./EventDetails.styles";

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
		packages,
		eventLabel,
	} = useEventDetails(eventId);

	/*
	 * v1 bumped a refreshKey on focus to re-fetch the event, attachments and
	 * worker names, because all three were one-shot reads. Every one of them is
	 * a live subscription now, so the screen is already current on focus.
	 */

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

	const { companyId, isAdmin } = useUser();

	/*
	 * Packages and the event label used to be fetched here — a getPackageDetails
	 * per package id, plus a direct Firestore read for the label. Both now come
	 * from useEventDetails as one batched query each.
	 */

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
								{moment(event.dateKey).format(
									"dddd, MMMM D, YYYY",
								)}
							</Text>
						</View>

						{event.startAt && (
							<View style={styles.timeContainer}>
								<Ionicons
									name="time-outline"
									size={20}
									color="#2089dc"
									style={styles.icon}
								/>
								<View style={styles.timeTextContainer}>
									<Text style={styles.timeText}>
										{moment(event.startAt).format("h:mm A")}
										{event.endAt && (
											<Text style={styles.timeText}>
												{" - "}
												{moment(event.endAt).format(
													"h:mm A",
												)}
											</Text>
										)}
									</Text>
									{event.durationSeconds ? (
										<Text style={styles.durationText}>
											Duration:{" "}
											{(
												event.durationSeconds / 3600
											).toFixed(1)}{" "}
											hours
										</Text>
									) : null}
								</View>
							</View>
						)}
					</View>
				</View>

				{/* Workers & Notes Card */}
				{(event.assignedUserIds?.length > 0 || event.adminNotes) && (
					<View style={styles.card}>
						{event.assignedUserIds?.length > 0 && (
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

						{event.adminNotes && (
							<View
								style={[
									styles.section,
									event.assignedUserIds?.length > 0 &&
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
								<Text style={styles.text}>
									{event.adminNotes}
								</Text>
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
								Packages
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
																	: checklist.id,
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
																: checklist.id
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
														: checklist.id,
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

export default EventDetails;
