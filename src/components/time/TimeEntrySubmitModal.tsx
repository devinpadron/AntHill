import React, { useState, useEffect } from "react";
import {
	Modal,
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	FlatList,
} from "react-native";
import { format } from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getEventsByDate } from "../../services/eventService";
import { useUser } from "../../contexts/UserContext";
import moment from "moment";

const TimeEntrySubmitModal = ({ visible, timeEntry, onClose, onSubmit }) => {
	const [notes, setNotes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState(null);
	const [otherAvailableEvents, setOtherAvailableEvents] = useState([]);
	const [selectedEvents, setSelectedEvents] = useState([]);
	const [isLoadingEvents, setIsLoadingEvents] = useState(false);
	const [showOtherEvents, setShowOtherEvents] = useState(false);
	const { userId, companyId } = useUser();

	// Fetch relevant events when modal opens
	useEffect(() => {
		if (visible && timeEntry) {
			fetchRelatedEvents();
		}
	}, [visible, timeEntry]);

	// Function to fetch events related to the time entry
	const fetchRelatedEvents = async () => {
		if (!timeEntry || !companyId || !userId) return;

		try {
			setIsLoadingEvents(true);

			// Get date string in YYYY-MM-DD format for getEventsByDate
			const clockInDate = moment(new Date(timeEntry.clockInTime)).format(
				"YYYY-MM-DD",
			);
			const events = await getEventsByDate(companyId, clockInDate);

			// First filter events by assigned workers
			const userEvents = events.filter((event) => {
				// Include events where this user is assigned
				// If no assignedWorkers property or it's empty, don't include the event
				if (
					!event.assignedWorkers ||
					!Array.isArray(event.assignedWorkers)
				) {
					return false;
				}

				// Check if the current user is in the assignedWorkers list
				return event.assignedWorkers.includes(userId);
			});

			// Filter events based on time criteria
			const clockInTime = new Date(timeEntry.clockInTime).getTime();
			const clockOutTime = new Date(timeEntry.clockOutTime).getTime();

			const autoConnectedEvents = [];
			const otherEvents = [];

			userEvents.forEach((event) => {
				// Case 1: All day events (no specific start time)
				if (!event.startTime) {
					autoConnectedEvents.push(event);
					return;
				}

				// Convert event start time to milliseconds
				const eventStartTime = new Date(event.startTime).getTime();

				// Case 2: Event starts within 30 mins of clock in
				const thirtyMinsBeforeClockIn = clockInTime - 30 * 60 * 1000;
				const thirtyMinsAfterClockIn = clockInTime + 30 * 60 * 1000;
				const isWithin30MinsOfClockIn =
					eventStartTime >= thirtyMinsBeforeClockIn &&
					eventStartTime <= thirtyMinsAfterClockIn;

				// Case 3: Event falls between clock in and clock out time
				const isBetweenClockInAndOut =
					eventStartTime >= clockInTime &&
					eventStartTime <= clockOutTime;

				if (isWithin30MinsOfClockIn || isBetweenClockInAndOut) {
					autoConnectedEvents.push(event);
				} else {
					otherEvents.push(event);
				}
			});

			setSelectedEvents(autoConnectedEvents);
			setOtherAvailableEvents(otherEvents);
		} catch (err) {
			console.error("Error fetching events:", err);
			setError("Failed to retrieve related events");
		} finally {
			setIsLoadingEvents(false);
		}
	};

	const formatDuration = (durationSeconds) => {
		const hours = Math.floor(durationSeconds / 3600);
		const minutes = Math.floor((durationSeconds % 3600) / 60);
		return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
	};

	// Add an event to selected events
	const addEvent = (event) => {
		setSelectedEvents((prev) => [...prev, event]);
		// Remove from other available events when added to selected
		setOtherAvailableEvents((prev) =>
			prev.filter((e) => e.id !== event.id),
		);
	};

	// Remove an event from selected events and add to other available events
	const removeEvent = (eventId) => {
		// Find the event before removing it
		const eventToRemove = selectedEvents.find(
			(event) => event.id === eventId,
		);

		// Remove from selected events
		setSelectedEvents((prev) =>
			prev.filter((event) => event.id !== eventId),
		);

		// If we found the event, add it to other available events
		if (eventToRemove) {
			setOtherAvailableEvents((prev) => [...prev, eventToRemove]);
		}
	};

	// Check if event is already selected
	const isEventSelected = (eventId) => {
		return selectedEvents.some((event) => event.id === eventId);
	};

	const handleSubmit = async () => {
		try {
			setIsSubmitting(true);
			setError(null);

			// Create a modified time entry with the selected events attached
			const enrichedTimeEntry = {
				...timeEntry,
				notes: notes,
				submittedAt: new Date().toISOString(),
				status: "pending_approval",
				connectedEvents: selectedEvents.map((event) => ({
					eventId: event.id,
					eventTitle: event.title,
				})),
			};

			console.log("Enriched Time Entry:", enrichedTimeEntry);

			// Pass the enriched time entry to the submit handler
			await onSubmit(enrichedTimeEntry.id, enrichedTimeEntry);

			setNotes(""); // Clear notes after successful submission
			onClose(); // Close modal
		} catch (err) {
			setError("Failed to submit time entry. Please try again.");
			console.error("Error submitting time entry:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!timeEntry) return null;

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.modalContainer}
			>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Submit Time Entry</Text>
						<TouchableOpacity
							onPress={onClose}
							disabled={isSubmitting}
						>
							<Icon name="close" size={24} color="#999" />
						</TouchableOpacity>
					</View>

					{/* Time Entry Details Card */}
					<View style={styles.entryDetails}>
						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>Date:</Text>
							<Text style={styles.detailValue}>
								{format(
									new Date(timeEntry.clockInTime),
									"EEEE, MMMM d, yyyy",
								)}
							</Text>
						</View>

						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>Time:</Text>
							<Text style={styles.detailValue}>
								{format(
									new Date(timeEntry.clockInTime),
									"h:mm a",
								)}{" "}
								-{" "}
								{format(
									new Date(timeEntry.clockOutTime),
									"h:mm a",
								)}
							</Text>
						</View>

						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>Duration:</Text>
							<Text style={styles.detailValue}>
								{formatDuration(timeEntry.duration)}
							</Text>
						</View>
					</View>

					{/* Connected Events Card - Separate from Time Entry Details */}
					{isLoadingEvents ? (
						<View style={styles.eventsCard}>
							<View style={styles.eventsLoadingContainer}>
								<ActivityIndicator size="small" color="#666" />
								<Text style={styles.loadingText}>
									Finding related events...
								</Text>
							</View>
						</View>
					) : (
						<View style={styles.eventsCard}>
							<Text style={styles.cardTitle}>
								Connected Events
							</Text>

							{selectedEvents.length > 0 ? (
								<View style={styles.relatedEventsContainer}>
									{selectedEvents.map((event) => (
										<View
											key={event.id}
											style={styles.eventRow}
										>
											<View style={styles.eventInfo}>
												<Icon
													name="calendar"
													size={16}
													color="#007AFF"
												/>
												<Text style={styles.eventItem}>
													{event.title}
												</Text>
											</View>
											<TouchableOpacity
												onPress={() =>
													removeEvent(event.id)
												}
												style={styles.eventActionButton}
											>
												<Icon
													name="close-circle"
													size={20}
													color="#FF3B30"
												/>
											</TouchableOpacity>
										</View>
									))}
								</View>
							) : (
								<Text style={styles.noEventsText}>
									No events connected to this time entry
								</Text>
							)}

							{/* Toggle for other available events */}
							{otherAvailableEvents.length > 0 && (
								<TouchableOpacity
									style={styles.toggleOtherEventsButton}
									onPress={() =>
										setShowOtherEvents(!showOtherEvents)
									}
								>
									<Text style={styles.toggleButtonText}>
										{showOtherEvents
											? "Possible Connections"
											: `Possible Connections (${otherAvailableEvents.length})`}
									</Text>
									<Icon
										name={
											showOtherEvents
												? "chevron-up"
												: "chevron-down"
										}
										size={20}
										color="#007AFF"
									/>
								</TouchableOpacity>
							)}

							{/* Other available events section */}
							{showOtherEvents &&
								otherAvailableEvents.length > 0 && (
									<View style={styles.otherEventsContainer}>
										{otherAvailableEvents.map((event) => (
											<View
												key={event.id}
												style={styles.eventRow}
											>
												<View style={styles.eventInfo}>
													<Icon
														name="calendar-outline"
														size={16}
														color="#666"
													/>
													<Text
														style={
															styles.otherEventItem
														}
													>
														{event.title}
													</Text>
												</View>
												{!isEventSelected(event.id) && (
													<TouchableOpacity
														onPress={() =>
															addEvent(event)
														}
														style={
															styles.eventActionButton
														}
													>
														<Icon
															name="plus-circle"
															size={20}
															color="#4CD964"
														/>
													</TouchableOpacity>
												)}
											</View>
										))}
									</View>
								)}
						</View>
					)}

					<Text style={styles.notesLabel}>Notes/Comments:</Text>
					<TextInput
						style={styles.notesInput}
						multiline
						numberOfLines={4}
						placeholder="Add any comments about this time entry"
						value={notes}
						onChangeText={setNotes}
						editable={!isSubmitting}
					/>

					{error && <Text style={styles.errorText}>{error}</Text>}

					<View style={styles.buttonRow}>
						<TouchableOpacity
							style={[styles.button, styles.cancelButton]}
							onPress={onClose}
							disabled={isSubmitting}
						>
							<Text style={styles.cancelButtonText}>Cancel</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.button,
								styles.submitButton,
								isSubmitting && styles.disabledButton,
							]}
							onPress={handleSubmit}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<ActivityIndicator size="small" color="white" />
							) : (
								<Text style={styles.submitButtonText}>
									Submit for Approval
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: "center",
		backgroundColor: "rgba(0,0,0,0.5)",
		padding: 16,
	},
	modalContent: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	entryDetails: {
		backgroundColor: "#f7f7f7",
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
	},
	detailRow: {
		flexDirection: "row",
		marginBottom: 6,
	},
	detailLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		width: 70,
	},
	detailValue: {
		fontSize: 14,
		color: "#333",
		flex: 1,
	},
	notesLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
		marginBottom: 6,
	},
	notesInput: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 14,
		color: "#333",
		height: 100,
		textAlignVertical: "top",
		marginBottom: 16,
	},
	errorText: {
		color: "#ff3b30",
		marginBottom: 12,
	},
	buttonRow: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	button: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	cancelButton: {
		backgroundColor: "#f2f2f2",
		flex: 1,
		marginRight: 8,
	},
	submitButton: {
		backgroundColor: "#007AFF",
		flex: 2,
	},
	disabledButton: {
		backgroundColor: "#80b3ff",
	},
	cancelButtonText: {
		color: "#666",
		fontWeight: "500",
	},
	submitButtonText: {
		color: "white",
		fontWeight: "600",
	},
	eventsCard: {
		backgroundColor: "#f0f7ff",
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
		borderLeftWidth: 3,
		borderLeftColor: "#007AFF",
	},
	cardTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333",
		marginBottom: 8,
	},
	relatedEventsContainer: {
		marginTop: 2,
	},
	eventItem: {
		fontSize: 14,
		color: "#333",
		marginLeft: 4,
		marginTop: 2,
		lineHeight: 20,
	},
	eventsLoadingContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	loadingText: {
		fontSize: 14,
		color: "#666",
		marginLeft: 8,
	},
	eventRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 6,
	},
	eventInfo: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	eventActionButton: {
		padding: 4,
	},
	noEventsText: {
		fontStyle: "italic",
		color: "#666",
		marginVertical: 4,
	},
	toggleOtherEventsButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 8,
		marginTop: 8,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 122, 255, 0.2)",
	},
	toggleButtonText: {
		color: "#007AFF",
		fontSize: 14,
		marginRight: 4,
	},
	otherEventsContainer: {
		marginTop: 8,
		paddingTop: 8,
	},
	otherEventsTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		marginBottom: 8,
	},
	otherEventItem: {
		fontSize: 14,
		color: "#666",
		marginLeft: 4,
	},
});

export default TimeEntrySubmitModal;
