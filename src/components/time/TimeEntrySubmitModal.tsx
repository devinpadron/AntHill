import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	Platform,
	Keyboard,
} from "react-native";
import { format } from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getEventsByDate } from "../../services/eventService";
import { useUser } from "../../contexts/UserContext";
import moment from "moment";
import { getCompanyPreferences } from "../../services/companyService";
import BottomSheet, {
	BottomSheetScrollView,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomFormRender from "./CustomFormRender";
import { uploadFile } from "../../utils/fileUtils";

const TimeEntrySubmitModal = ({ visible, timeEntry, onClose, onSubmit }) => {
	const [notes, setNotes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState(null);
	const [otherAvailableEvents, setOtherAvailableEvents] = useState([]);
	const [selectedEvents, setSelectedEvents] = useState([]);
	const [isLoadingEvents, setIsLoadingEvents] = useState(false);
	const [showOtherEvents, setShowOtherEvents] = useState(false);
	const { userId, companyId } = useUser();
	const [customForm, setCustomForm] = useState(null);
	const [formResponses, setFormResponses] = useState({});
	const [formErrors, setFormErrors] = useState({});
	const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
	const [uploadProgress, setUploadProgress] = useState<
		Record<string, number>
	>({});
	const insets = useSafeAreaInsets();

	const bottomSheetRef = useRef(null);
	const scrollViewRef = useRef(null);
	const notesInputRef = useRef(null);
	const snapPoints = useRef(["85%"]).current;

	useEffect(() => {
		if (visible && bottomSheetRef.current) {
			bottomSheetRef.current.expand();
		} else if (!visible && bottomSheetRef.current) {
			bottomSheetRef.current.close();
		}
	}, [visible]);

	const handleClosePress = useCallback(() => {
		Keyboard?.dismiss();
		if (bottomSheetRef.current) {
			bottomSheetRef.current.close();
		}
		onClose();
	}, [onClose]);

	useEffect(() => {
		if (visible && timeEntry) {
			fetchRelatedEvents();
		}
	}, [visible, timeEntry]);

	useEffect(() => {
		const loadCustomForm = async () => {
			if (!companyId) return;

			try {
				const preferences = await getCompanyPreferences(companyId);
				if (preferences?.timeEntryForm?.isEnabled) {
					setCustomForm(preferences.timeEntryForm);

					const initialResponses = {};
					preferences.timeEntryForm.fields.forEach((field) => {
						if (field.type === "checkbox") {
							initialResponses[field.id] = false;
						} else if (field.type === "multiSelect") {
							initialResponses[field.id] = [];
						} else {
							initialResponses[field.id] = "";
						}
					});
					setFormResponses(initialResponses);
				}
			} catch (error) {
				console.error("Failed to load custom form:", error);
			}
		};

		if (visible) {
			loadCustomForm();
		}
	}, [visible, companyId]);

	const fetchRelatedEvents = async () => {
		if (!timeEntry || !companyId || !userId) return;

		try {
			setIsLoadingEvents(true);

			const clockInDate = moment(new Date(timeEntry.clockInTime)).format(
				"YYYY-MM-DD",
			);
			const events = await getEventsByDate(companyId, clockInDate);

			const userEvents = events.filter((event) => {
				if (
					!event.assignedWorkers ||
					!Array.isArray(event.assignedWorkers)
				) {
					return false;
				}

				return event.assignedWorkers.includes(userId);
			});

			const clockInTime = new Date(timeEntry.clockInTime).getTime();
			const clockOutTime = new Date(timeEntry.clockOutTime).getTime();

			const autoConnectedEvents = [];
			const otherEvents = [];

			userEvents.forEach((event) => {
				if (!event.startTime) {
					autoConnectedEvents.push(event);
					return;
				}

				const eventStartTime = new Date(event.startTime).getTime();

				const thirtyMinsBeforeClockIn = clockInTime - 30 * 60 * 1000;
				const thirtyMinsAfterClockIn = clockInTime + 30 * 60 * 1000;
				const isWithin30MinsOfClockIn =
					eventStartTime >= thirtyMinsBeforeClockIn &&
					eventStartTime <= thirtyMinsAfterClockIn;

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

	const addEvent = (event) => {
		setSelectedEvents((prev) => [...prev, event]);
		setOtherAvailableEvents((prev) =>
			prev.filter((e) => e.id !== event.id),
		);
	};

	const removeEvent = (eventId) => {
		const eventToRemove = selectedEvents.find(
			(event) => event.id === eventId,
		);

		setSelectedEvents((prev) =>
			prev.filter((event) => event.id !== eventId),
		);

		if (eventToRemove) {
			setOtherAvailableEvents((prev) => [...prev, eventToRemove]);
		}
	};

	const isEventSelected = (eventId) => {
		return selectedEvents.some((event) => event.id === eventId);
	};

	const handleFieldChange = (fieldId, value) => {
		setFormResponses((prev) => ({
			...prev,
			[fieldId]: value,
		}));

		if (formErrors[fieldId]) {
			setFormErrors((prev) => ({
				...prev,
				[fieldId]: null,
			}));
		}
	};

	const validateForm = () => {
		if (!customForm) return true;

		const errors = {};
		let isValid = true;

		customForm.fields.forEach((field) => {
			if (field.required) {
				const value = formResponses[field.id];

				if (
					value === undefined ||
					value === null ||
					value === "" ||
					(Array.isArray(value) && value.length === 0)
				) {
					errors[field.id] = `${field.label} is required`;
					isValid = false;
				}
			}
		});

		setFormErrors(errors);
		return isValid;
	};

	const handleFormSubmit = async (enrichedTimeEntry) => {
		const allFiles = [];

		if (customForm && enrichedTimeEntry.formResponses) {
			Object.entries(enrichedTimeEntry.formResponses).forEach(
				([fieldId, value]) => {
					const field = customForm.fields.find(
						(f) => f.id === fieldId,
					);
					if (
						(field?.type === "document" ||
							field?.type === "media") &&
						Array.isArray(value)
					) {
						allFiles.push(...value);
					}
				},
			);
		}

		if (allFiles.length > 0) {
			try {
				const uploadedFiles = {};

				setUploadingFiles(allFiles.map((f) => f.uri));

				await Promise.all(
					allFiles.map(async (file) => {
						const uploadedFile = await uploadFile(
							file,
							timeEntry.id,
							companyId,
							(uri, progress) => {
								setUploadProgress((prev) => ({
									...prev,
									[uri]: progress,
								}));
							},
						);
						uploadedFiles[file.uri] = uploadedFile;
					}),
				);

				const updatedFormResponses = {
					...enrichedTimeEntry.formResponses,
				};

				Object.keys(updatedFormResponses).forEach((fieldId) => {
					const value = updatedFormResponses[fieldId];
					if (
						Array.isArray(value) &&
						value.length > 0 &&
						value[0].uri
					) {
						updatedFormResponses[fieldId] = value.map(
							(file) => uploadedFiles[file.uri] || file,
						);
					}
				});

				return {
					...enrichedTimeEntry,
					formResponses: updatedFormResponses,
				};
			} finally {
				setUploadingFiles([]);
				setUploadProgress({});
			}
		}

		return enrichedTimeEntry;
	};

	const handleSubmit = async () => {
		try {
			setIsSubmitting(true);
			setError(null);

			if (customForm && !validateForm()) {
				setError("Please complete all required fields");
				return;
			}

			const enrichedTimeEntry = {
				...timeEntry,
				notes: notes,
				submittedAt: new Date().toISOString(),
				status: "pending_approval",
				connectedEvents: selectedEvents.map((event) => ({
					eventId: event.id,
					eventTitle: event.title,
				})),
				formResponses: customForm ? formResponses : null,
			};

			const finalTimeEntry = await handleFormSubmit(enrichedTimeEntry);

			await onSubmit(timeEntry.id, finalTimeEntry);

			setNotes("");
			handleClosePress();
		} catch (err) {
			setError("Failed to submit time entry. Please try again.");
			console.error("Error submitting time entry:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleNotesFocus = () => {
		setTimeout(() => {
			if (scrollViewRef.current) {
				scrollViewRef.current.scrollToEnd({ animated: true });
			}
		}, 300);
	};

	if (!timeEntry || !visible) return null;

	return (
		<BottomSheet
			ref={bottomSheetRef}
			snapPoints={snapPoints}
			enablePanDownToClose
			onClose={onClose}
			handleIndicatorStyle={styles.sheetIndicator}
			backgroundStyle={styles.sheetBackground}
			keyboardBehavior="extend"
			android_keyboardInputMode="adjustResize"
		>
			<View style={[styles.modalHeader, { paddingTop: 0 }]}>
				<Text style={styles.modalTitle}>Submit Time Entry</Text>
			</View>

			<BottomSheetScrollView
				ref={scrollViewRef}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom },
				]}
				keyboardShouldPersistTaps="handled"
				nestedScrollEnabled={true}
				scrollEnabled={!customForm?.fields.some((f) => f.isOpen)}
				keyboardDismissMode="interactive"
			>
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
							{format(new Date(timeEntry.clockInTime), "h:mm a")}{" "}
							-{" "}
							{format(new Date(timeEntry.clockOutTime), "h:mm a")}
						</Text>
					</View>

					<View style={styles.detailRow}>
						<Text style={styles.detailLabel}>Duration:</Text>
						<Text style={styles.detailValue}>
							{formatDuration(timeEntry.duration)}
						</Text>
					</View>
				</View>

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
						<Text style={styles.cardTitle}>Connected Events</Text>

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

						{showOtherEvents && otherAvailableEvents.length > 0 && (
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
											<Text style={styles.otherEventItem}>
												{event.title}
											</Text>
										</View>
										{!isEventSelected(event.id) && (
											<TouchableOpacity
												onPress={() => addEvent(event)}
												style={styles.eventActionButton}
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

				{customForm && (
					<CustomFormRender
						customForm={customForm}
						formResponses={formResponses}
						formErrors={formErrors}
						onFieldChange={handleFieldChange}
						setCustomForm={setCustomForm}
						uploadingFiles={uploadingFiles}
						uploadProgress={uploadProgress}
					/>
				)}

				<Text style={styles.notesLabel}>Notes/Comments:</Text>
				<BottomSheetTextInput
					ref={notesInputRef}
					style={styles.notesInput}
					multiline
					numberOfLines={4}
					placeholder="Add any comments about this time entry"
					value={notes}
					onChangeText={setNotes}
					editable={!isSubmitting}
					onFocus={handleNotesFocus}
				/>

				{error && <Text style={styles.errorText}>{error}</Text>}

				<View style={styles.buttonRow}>
					<TouchableOpacity
						style={[styles.button, styles.cancelButton]}
						onPress={handleClosePress}
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
			</BottomSheetScrollView>
		</BottomSheet>
	);
};

const styles = StyleSheet.create({
	sheetBackground: {
		backgroundColor: "white",
	},
	sheetIndicator: {
		backgroundColor: "#ccc",
		width: 40,
		height: 4,
	},
	scrollContent: {
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
		paddingBottom: 12,
		paddingHorizontal: 20,
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
		marginBottom: 8,
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
