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
	Alert,
} from "react-native";
import { format } from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { getEventsByDate } from "../../services/eventService";
import { useUser } from "../../contexts/UserContext";
import { useUploadManager } from "../../contexts/UploadManagerContext"; // Add this import
import moment from "moment";
import BottomSheet, {
	BottomSheetScrollView,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomFormRender from "./CustomFormRender";
import { useCompany } from "../../contexts/CompanyContext";

//TODO: What I did before was attach the formResponses directly to each connected event
// Next we need to:
// 1. Update the timeEntryDetails to handle the new structure and display the form responses correctly

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
	const [customFullForm, setCustomFullForm] = useState(null);
	const [fullFormResponses, setFullFormResponses] = useState({});
	// Replace single formResponses with a map keyed by event ID
	const [formResponsesByEvent, setFormResponsesByEvent] = useState({});
	// Replace single formErrors with a map keyed by event ID
	const [formErrorsByEvent, setFormErrorsByEvent] = useState({});
	const [fullFormErrors, setFullFormErrors] = useState({});
	// Update filesToUpload to be organized by event
	const [filesToUpload, setFilesToUpload] = useState({});
	const { uploadFiles, isUploading, uploadProgress, resetUploadProgress } =
		useUploadManager();

	const bottomSheetRef = useRef(null);
	const scrollViewRef = useRef(null);
	const notesInputRef = useRef(null);
	const snapPoints = useRef(["85%"]).current;
	const insets = useSafeAreaInsets();
	const { preferences } = useCompany();

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

	// First useEffect - only for initializing the form templates
	useEffect(() => {
		const loadCustomForms = async () => {
			if (!companyId) return;

			try {
				if (preferences?.eventForm?.isEnabled) {
					setCustomForm(preferences.eventForm);
				}

				if (preferences?.timeEntryForm?.isEnabled) {
					setCustomFullForm(preferences.timeEntryForm);

					// Only initialize the full form responses if they're empty
					if (Object.keys(fullFormResponses).length === 0) {
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
						setFullFormResponses(initialResponses);
					}
				}
			} catch (error) {
				console.error("Failed to load custom forms:", error);
			}
		};

		if (visible) {
			loadCustomForms();
		}
	}, [visible, companyId]); // Remove selectedEvents.length

	// Second useEffect - only for initializing event form responses
	useEffect(() => {
		if (!customForm || !visible) return;

		// Initialize empty responses for existing events
		if (selectedEvents.length > 0) {
			initializeFormResponsesForEvents(selectedEvents, customForm);
		}
	}, [customForm, selectedEvents, visible]);

	// Add this helper function
	const initializeFormResponsesForEvents = (events, formTemplate) => {
		const newResponsesByEvent = { ...formResponsesByEvent };

		events.forEach((event) => {
			// Skip if we already have responses for this event
			if (newResponsesByEvent[event.id]) return;

			const initialResponses = {};
			formTemplate.fields.forEach((field) => {
				if (field.type === "checkbox") {
					initialResponses[field.id] = false;
				} else if (field.type === "multiSelect") {
					initialResponses[field.id] = [];
				} else {
					initialResponses[field.id] = "";
				}
			});

			newResponsesByEvent[event.id] = initialResponses;
		});

		setFormResponsesByEvent(newResponsesByEvent);

		// Initialize empty errors object
		const newErrorsByEvent = { ...formErrorsByEvent };
		events.forEach((event) => {
			if (!newErrorsByEvent[event.id]) {
				newErrorsByEvent[event.id] = {};
			}
		});
		setFormErrorsByEvent(newErrorsByEvent);
	};

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

		// Initialize form responses for the new event
		if (customForm) {
			initializeFormResponsesForEvents([event], customForm);
		}
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

			// Remove form responses for this event
			setFormResponsesByEvent((prev) => {
				const updated = { ...prev };
				delete updated[eventId];
				return updated;
			});

			setFormErrorsByEvent((prev) => {
				const updated = { ...prev };
				delete updated[eventId];
				return updated;
			});

			// Remove any files to upload for this event
			setFilesToUpload((prev) => {
				const updated = { ...prev };
				// Only remove keys that are for this event (formatted as "eventId-fieldId")
				Object.keys(updated).forEach((key) => {
					if (key.startsWith(`${eventId}-`)) {
						delete updated[key];
					}
				});
				return updated;
			});
		}
	};

	const isEventSelected = (eventId) => {
		return selectedEvents.some((event) => event.id === eventId);
	};

	// Updated to track files that need uploading
	const handleFieldChange = (eventId, fieldId, fieldType, value) => {
		if (eventId === "fullForm") {
			// Handle changes for the full form
			setFullFormResponses((prev) => ({
				...prev,
				[fieldId]: value,
			}));
		} else {
			setFormResponsesByEvent((prev) => ({
				...prev,
				[eventId]: {
					...prev[eventId],
					[fieldId]: value,
				},
			}));
		}

		// If this is a document or media field, track files that need uploading
		if (fieldType === "document" || fieldType === "media") {
			if (Array.isArray(value)) {
				// Find files that don't have a downloadUrl (new uploads)
				const newFiles = value.filter(
					(file) => !file.downloadUrl && !file.url,
				);

				if (newFiles.length > 0) {
					if (eventId === "fullForm") {
						// For full form, we don't track files by event
						setFilesToUpload((prev) => ({
							...prev,
							[fieldId]: newFiles,
						}));
					} else {
						setFilesToUpload((prev) => ({
							...prev,
							[`${eventId}-${fieldId}`]: newFiles,
						}));
					}
				}
			}
		}

		if (formErrorsByEvent[eventId]?.[fieldId]) {
			if (eventId === "fullForm") {
				// Clear error for full form field
				setFullFormErrors((prev) => ({
					...prev,
					[fieldId]: null,
				}));
			} else {
				setFormErrorsByEvent((prev) => ({
					...prev,
					[eventId]: {
						...prev[eventId],
						[fieldId]: null,
					},
				}));
			}
		}
	};

	const validateForms = () => {
		if (!customForm && !customFullForm) return true;

		const newErrorsByEvent = { ...formErrorsByEvent };
		let isValid = true;

		// Validate event-specific forms
		if (customForm) {
			selectedEvents.forEach((event) => {
				const eventErrors = {};
				let eventIsValid = true;

				customForm.fields.forEach((field) => {
					if (field.required) {
						const value =
							formResponsesByEvent[event.id]?.[field.id];

						if (
							value === undefined ||
							value === null ||
							value === "" ||
							(Array.isArray(value) && value.length === 0)
						) {
							eventErrors[field.id] =
								`${field.label} is required`;
							eventIsValid = false;
							isValid = false;
						}
					}
				});

				newErrorsByEvent[event.id] = eventErrors;
			});

			setFormErrorsByEvent(newErrorsByEvent);
		}

		// Validate the full form
		if (customFullForm) {
			const fullFormErrorsObj = {};
			let fullFormIsValid = true;

			customFullForm.fields.forEach((field) => {
				if (field.required) {
					const value = fullFormResponses[field.id];

					if (
						value === undefined ||
						value === null ||
						value === "" ||
						(Array.isArray(value) && value.length === 0)
					) {
						fullFormErrorsObj[field.id] =
							`${field.label} is required`;
						fullFormIsValid = false;
						isValid = false;
					}
				}
			});

			setFullFormErrors(fullFormErrorsObj);

			// If the full form is invalid, update the isValid flag
			if (!fullFormIsValid) {
				isValid = false;
			}
		}

		return isValid;
	};

	// Updated to handle file uploads before submission
	const handleSubmit = async () => {
		if (selectedEvents.length === 0) {
			setError("Please attach at least one event to this time entry.");
			return;
		}

		try {
			setIsSubmitting(true);
			setError(null);

			if ((customForm || customFullForm) && !validateForms()) {
				let errorMessage = "Please complete all required fields";

				// Check if there are full form errors
				const hasFullFormErrors = Object.keys(fullFormErrors).some(
					(key) =>
						fullFormErrors[key] !== null &&
						fullFormErrors[key] !== undefined,
				);

				// Check if there are event form errors
				const hasEventFormErrors = Object.values(
					formErrorsByEvent,
				).some((errors) => Object.keys(errors).length > 0);

				if (hasFullFormErrors && hasEventFormErrors) {
					errorMessage =
						"Please complete all required fields in the time entry and event forms";
				} else if (hasFullFormErrors) {
					errorMessage =
						"Please complete all required fields in the time entry form";
				} else if (hasEventFormErrors) {
					errorMessage =
						"Please complete all required fields in the event forms";
				}
				setError(errorMessage);
				setIsSubmitting(false);
				return;
			}

			// Check if we have files to upload
			const pendingUploads = Object.values(filesToUpload).flat();
			if (pendingUploads.length > 0) {
				try {
					// Create temporary IDs for files if they don't have them
					const filesWithIds = pendingUploads.map((file: any) => {
						// Ensure file is an object before spreading
						if (file && typeof file === "object") {
							return {
								...file,
								id:
									file.id ||
									`file-${Date.now()}-${Math.random()
										.toString(36)
										.substring(2, 9)}`,
							};
						}
						// Handle non-object files
						return {
							id: `file-${Date.now()}-${Math.random()
								.toString(36)
								.substring(2, 9)}`,
						};
					});

					// Upload the files
					console.log("Files with IDS: ", filesWithIds);
					const uploadedFiles = await uploadFiles(
						filesWithIds,
						companyId,
						timeEntry.id,
						"TimeEntries",
					);
					console.log("Uploaded Files: ", uploadedFiles);

					// Update form responses with uploaded file references
					const updatedFormResponsesByEvent = {
						...formResponsesByEvent,
					};

					// Create a copy of the full form responses to update
					const updatedFullFormResponses = { ...fullFormResponses };

					Object.keys(filesToUpload).forEach((key) => {
						if (key.includes("-")) {
							// This is for event-specific forms
							// key format is "eventId-fieldId"
							const [eventId, fieldId] = key.split("-");

							if (updatedFormResponsesByEvent[eventId]) {
								const fieldFiles = [
									...(updatedFormResponsesByEvent[eventId][
										fieldId
									] || []),
								];

								// Replace local files with uploaded versions
								const updatedFiles = fieldFiles.map((file) => {
									const uploadedFile = uploadedFiles.find(
										(u) =>
											file.uri === u.uri ||
											(file.id && file.id === u.id),
									);
									return uploadedFile || file;
								});

								updatedFormResponsesByEvent[eventId][fieldId] =
									updatedFiles;
							}
						} else {
							// This is for the full form
							// key is just the fieldId
							const fieldId = key;
							const fieldFiles = [
								...(updatedFullFormResponses[fieldId] || []),
							];

							// Replace local files with uploaded versions
							const updatedFiles = fieldFiles.map((file) => {
								const uploadedFile = uploadedFiles.find(
									(u) =>
										file.uri === u.uri ||
										(file.id && file.id === u.id),
								);
								return uploadedFile || file;
							});

							updatedFullFormResponses[fieldId] = updatedFiles;
						}
					});

					// Now submit with the updated form responses
					await submitTimeEntry(
						updatedFormResponsesByEvent,
						updatedFullFormResponses,
					);
				} catch (uploadError) {
					console.error("Error uploading files:", uploadError);
					setError("Failed to upload files. Please try again.");
					setIsSubmitting(false);
					return;
				}
			} else {
				// No files to upload, submit directly
				await submitTimeEntry(formResponsesByEvent, fullFormResponses);
			}
		} catch (err) {
			setError("Failed to submit time entry. Please try again.");
			console.error("Error submitting time entry:", err);
			setIsSubmitting(false);
		}
	};

	// Helper function for the actual submission
	const submitTimeEntry = async (
		finalFormResponsesByEvent,
		finalFullFormResponses,
	) => {
		const enrichedTimeEntry = {
			...timeEntry,
			notes: notes,
			submittedAt: new Date().toISOString(),
			status: "pending_approval",
			connectedEvents: selectedEvents.map((event) => ({
				eventId: event.id,
				eventTitle: event.title,
				formResponses: finalFormResponsesByEvent[event.id] || null,
			})),
			eventForm: customForm,
			generalForm: customFullForm,
			// Add the full form responses to the time entry
			formResponses: customFullForm ? finalFullFormResponses : null,
		};

		await onSubmit(timeEntry.id, enrichedTimeEntry);

		resetModalState();
		handleClosePress();
	};

	const handleNotesFocus = () => {
		setTimeout(() => {
			if (scrollViewRef.current) {
				scrollViewRef.current.scrollToEnd({ animated: true });
			}
		}, 300);
	};

	const [showAddEventInput, setShowAddEventInput] = useState(false);
	const [newEventTitle, setNewEventTitle] = useState("");

	const addCustomEvent = () => {
		if (!newEventTitle.trim()) {
			Alert.alert("Error", "Please enter an event title");
			return;
		}

		const newEvent = {
			id: `custom-${Date.now()}`,
			title: newEventTitle.trim(),
			isCustom: true,
		};

		setSelectedEvents((prev) => [...prev, newEvent]);
		setNewEventTitle("");
		setShowAddEventInput(false);
	};

	const resetModalState = () => {
		// Reset form data
		setFormResponsesByEvent({});
		setFullFormResponses({});
		setFormErrorsByEvent({});
		setFullFormErrors({});
		setFilesToUpload({});

		// Reset events
		setSelectedEvents([]);
		setOtherAvailableEvents([]);
		setShowOtherEvents(false);

		// Reset UI state
		setNotes("");
		setError(null);
		setIsSubmitting(false);
		setShowAddEventInput(false);
		setNewEventTitle("");

		// Reset upload state
		resetUploadProgress();
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
												{event.title}{" "}
												{event.isCustom
													? "(Custom)"
													: ""}
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

						{showAddEventInput ? (
							<View style={styles.addEventInputContainer}>
								<TextInput
									style={styles.addEventInput}
									placeholder="Enter event title"
									value={newEventTitle}
									onChangeText={setNewEventTitle}
									autoFocus
								/>
								<View style={styles.addEventButtonsRow}>
									<TouchableOpacity
										style={styles.addEventCancelButton}
										onPress={() => {
											setShowAddEventInput(false);
											setNewEventTitle("");
										}}
									>
										<Text style={styles.addEventCancelText}>
											Cancel
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={styles.addEventSaveButton}
										onPress={addCustomEvent}
									>
										<Text style={styles.addEventSaveText}>
											Add
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						) : (
							<TouchableOpacity
								style={styles.addEventButton}
								onPress={() => setShowAddEventInput(true)}
							>
								<Icon
									name="plus-circle"
									size={18}
									color="#007AFF"
								/>
								<Text style={styles.addEventButtonText}>
									Attach An Event
								</Text>
							</TouchableOpacity>
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

				{customForm && selectedEvents.length > 0 && (
					<View style={styles.eventFormsContainer}>
						<Text style={styles.eventFormsTitle}>
							Event Information:
						</Text>
						{selectedEvents.map((event) => (
							<View
								key={event.id}
								style={styles.eventFormContainer}
							>
								<View style={styles.eventFormHeader}>
									<Text style={styles.eventFormTitle}>
										{event.title}{" "}
										{event.isCustom ? "(Custom)" : ""}
									</Text>
								</View>
								<CustomFormRender
									customForm={customForm}
									formResponses={
										formResponsesByEvent[event.id] || {}
									}
									formErrors={
										formErrorsByEvent[event.id] || {}
									}
									onFieldChange={(
										fieldId,
										fieldType,
										value,
									) =>
										handleFieldChange(
											event.id,
											fieldId,
											fieldType,
											value,
										)
									}
									setCustomForm={setCustomForm}
									uploadProgress={uploadProgress}
								/>
							</View>
						))}
					</View>
				)}

				{customFullForm && (
					<CustomFormRender
						customForm={customFullForm}
						formResponses={fullFormResponses}
						formErrors={fullFormErrors}
						onFieldChange={(fieldId, fieldType, value) =>
							handleFieldChange(
								"fullForm",
								fieldId,
								fieldType,
								value,
							)
						}
						setCustomForm={setCustomFullForm}
						uploadProgress={uploadProgress}
					/>
				)}

				{/* Add a progress indicator when uploading */}
				{isUploading && (
					<View style={styles.uploadProgressContainer}>
						<ActivityIndicator size="small" color="#007AFF" />
						<Text style={styles.uploadProgressText}>
							Uploading files...{" "}
							{Object.values(uploadProgress).length > 0
								? `${Math.round(
										Object.values(uploadProgress).reduce(
											(acc, cur) => acc + cur.progress,
											0,
										) /
											Object.values(uploadProgress)
												.length,
									)}%`
								: ""}
						</Text>
					</View>
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
	uploadProgressContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f0f7ff",
		padding: 12,
		borderRadius: 8,
		marginBottom: 16,
	},
	uploadProgressText: {
		marginLeft: 8,
		color: "#007AFF",
		fontSize: 14,
	},
	addEventButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 8,
		marginTop: 6,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 122, 255, 0.2)",
	},
	addEventButtonText: {
		color: "#007AFF",
		fontSize: 14,
		marginLeft: 4,
	},
	addEventInputContainer: {
		marginTop: 8,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 122, 255, 0.2)",
		paddingTop: 8,
	},
	addEventInput: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 8,
		fontSize: 14,
	},
	addEventButtonsRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		marginTop: 8,
	},
	addEventCancelButton: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		marginRight: 8,
	},
	addEventCancelText: {
		color: "#666",
	},
	addEventSaveButton: {
		backgroundColor: "#007AFF",
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 6,
	},
	addEventSaveText: {
		color: "white",
		fontWeight: "500",
	},
	eventFormsContainer: {
		marginBottom: 16,
	},
	eventFormsTitle: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: 8,
	},
	eventFormContainer: {
		backgroundColor: "#f7f9fc",
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
		borderLeftWidth: 3,
		borderLeftColor: "#007AFF",
	},
	eventFormHeader: {
		marginBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
		paddingBottom: 8,
	},
	eventFormTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: "#333",
	},
});

export default TimeEntrySubmitModal;
