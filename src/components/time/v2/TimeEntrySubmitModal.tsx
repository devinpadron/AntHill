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
import { getEventsInRange } from "../../../services/v2/eventService";
import { useUser } from "../../../contexts/v2/UserContext";
import { useUploadManager } from "../../../contexts/v2/UploadManagerContext"; // Add this import
import moment from "moment";
import { FilterType } from "../../../types";
import { getSchema } from "../../../services/v2/formSchemaService";
import BottomSheet, {
	BottomSheetScrollView,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomFormRender from "./CustomFormRender";
import { useCompany } from "../../../contexts/v2/CompanyContext";

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
	const { uploadFiles, isUploading, uploadProgress } = useUploadManager();

	const bottomSheetRef = useRef(null);
	const scrollViewRef = useRef(null);
	const notesInputRef = useRef(null);
	const snapPoints = useRef(["85%"]).current;
	const insets = useSafeAreaInsets();
	const { preferences, isLoading: preferencesLoading } = useCompany();

	/*
	 * Whether the custom form is ready to be filled in.
	 *
	 * This gates SUBMISSION, and it has to. The form is not part of the first
	 * render: company preferences arrive over a subscription, and the schema
	 * they name is a second round trip after that. Until both land there are no
	 * fields on screen — so a fast tap submitted an entry containing clock
	 * times and nothing else, silently, with no way to tell afterwards that
	 * anything was missing.
	 *
	 * Production has 57 such entries in one company alone, spread thinly across
	 * 19 people (most of them a single entry out of dozens) and still arriving
	 * — the shape of a race, not of a misconfigured user.
	 *
	 * v1 had one await here and v2 has two, so the window got WIDER, not
	 * narrower.
	 */
	const [isSchemaLoading, setIsSchemaLoading] = useState(true);
	const isFormReady = !preferencesLoading && !isSchemaLoading;

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
		// Don't reset state here - only reset after successful submission
		onClose();
	}, [onClose]);

	useEffect(() => {
		if (visible && timeEntry) {
			// Only fetch events if we don't already have them loaded for this entry
			if (
				selectedEvents.length === 0 &&
				otherAvailableEvents.length === 0
			) {
				fetchRelatedEvents();
			}
		}
	}, [visible, timeEntry]);

	/*
	 * Resolve the two form schemas by reference.
	 *
	 * Preferences used to carry the schema objects inline; they now hold ids
	 * pointing at immutable versioned documents, so an entry submitted today
	 * keeps rendering against today's schema no matter how the form is edited
	 * later.
	 */
	useEffect(() => {
		if (!companyId) return;
		let cancelled = false;
		setIsSchemaLoading(true);

		(async () => {
			const [eventSchema, entrySchema] = await Promise.all([
				getSchema(preferences.eventFormSchemaId),
				getSchema(preferences.timeEntryFormSchemaId),
			]);
			if (cancelled) return;

			if (eventSchema?.isEnabled) setCustomForm(eventSchema);

			if (entrySchema?.isEnabled) {
				setCustomFullForm(entrySchema);

				if (Object.keys(fullFormResponses).length === 0) {
					const initialResponses = {};
					entrySchema.fields.forEach((field) => {
						if (field.type === "checkbox") {
							initialResponses[field.id] = false;
						} else if (
							field.type === "multiSelect" ||
							field.type === "checklist"
						) {
							initialResponses[field.id] = [];
						} else {
							initialResponses[field.id] = "";
						}
					});
					setFullFormResponses(initialResponses);
				}
			}

			setIsSchemaLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [
		companyId,
		preferences.eventFormSchemaId,
		preferences.timeEntryFormSchemaId,
	]);

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
				} else if (
					field.type === "multiSelect" ||
					field.type === "checklist"
				) {
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

			const clockInDate = moment(timeEntry.clockInAt.toDate()).format(
				"YYYY-MM-DD",
			);

			/*
			 * The server filters by assignment. v1 fetched every event on the
			 * day and then filtered in JS.
			 */
			const userEvents = await getEventsInRange(companyId, {
				from: clockInDate,
				to: clockInDate,
				filter: FilterType.MY,
				userId,
			});

			const clockInTime = timeEntry.clockInAt.toDate().getTime();
			const clockOutTime = timeEntry.clockOutAt
				? timeEntry.clockOutAt.toDate().getTime()
				: Date.now();

			const autoConnectedEvents = [];
			const otherEvents = [];

			userEvents.forEach((event) => {
				if (!event.startAt) {
					autoConnectedEvents.push(event);
					return;
				}

				const eventStartTime = event.startAt.toDate().getTime();

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
						if (field.type === "checklist") {
							// Use checklistRequiredMode for validation
							const requiredMode =
								field.checklistRequiredMode || "atLeastOne";
							const totalItems =
								typeof field.checklistItemCount === "number"
									? field.checklistItemCount
									: field.options?.length || 0;
							if (requiredMode === "atLeastOne") {
								if (
									!Array.isArray(value) ||
									value.length === 0
								) {
									eventErrors[field.id] =
										`${field.label} (at least one item) is required`;
									eventIsValid = false;
									isValid = false;
								}
							} else if (requiredMode === "all") {
								if (totalItems <= 0) {
									eventErrors[field.id] =
										`${field.label} has no items to complete`;
									eventIsValid = false;
									isValid = false;
								} else if (
									!Array.isArray(value) ||
									value.length !== totalItems
								) {
									eventErrors[field.id] =
										`${field.label} (all items) is required`;
									eventIsValid = false;
									isValid = false;
								}
							}
						} else if (
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
					if (field.type === "checklist") {
						const requiredMode =
							field.checklistRequiredMode || "atLeastOne";
						const totalItems =
							typeof field.checklistItemCount === "number"
								? field.checklistItemCount
								: field.options?.length || 0;

						if (requiredMode === "atLeastOne") {
							if (!Array.isArray(value) || value.length === 0) {
								fullFormErrorsObj[field.id] =
									`${field.label} (at least one item) is required`;
								fullFormIsValid = false;
								isValid = false;
							}
						} else if (requiredMode === "all") {
							// If no items are present, treat as invalid to avoid bypassing before load
							if (totalItems <= 0) {
								fullFormErrorsObj[field.id] =
									`${field.label} has no items to complete`;
								fullFormIsValid = false;
								isValid = false;
							} else if (
								!Array.isArray(value) ||
								value.length !== totalItems
							) {
								fullFormErrorsObj[field.id] =
									`${field.label} (all items) is required`;
								fullFormIsValid = false;
								isValid = false;
							}
						}
					} else if (
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
		/*
		 * Refuse while the form is still arriving. The button is disabled too,
		 * but this is the check that matters: submitting here writes an entry
		 * with no form data and no record that any was expected, and nobody
		 * finds out until payroll.
		 */
		if (!isFormReady) {
			setError("Still loading this company's form — one moment.");
			return;
		}

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
						companyId,
						"timeEntry",
						timeEntry.id,
						filesWithIds,
						userId,
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

								/*
								 * uploadFiles returns the ids it persisted, so a
								 * form answer becomes a REFERENCE rather than an
								 * inlined copy of the file object — which is what
								 * v1 embedded in formResponses.
								 */
								const updatedFiles = fieldFiles
									.map((file) => file.id)
									.filter((id) => uploadedFiles.includes(id));

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

							// Same as above: store ids, not file objects.
							const updatedFiles = fieldFiles
								.map((file) => file.id)
								.filter((id) => uploadedFiles.includes(id));

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
		/*
		 * A PATCH, not the whole entry.
		 *
		 * v1 spread `...timeEntry` from client state and wrote it back, so a
		 * device holding a stale copy could resurrect superseded values. It also
		 * embedded two complete form schemas per submission — the 4,087 copies
		 * the migration collapsed into 39 documents. Schemas are referenced now.
		 */
		const submission = {
			notes,
			formResponses: customFullForm ? finalFullFormResponses : {},
			formSchemaIds: {
				timeEntry: preferences.timeEntryFormSchemaId,
				event: preferences.eventFormSchemaId,
			},
			connections: selectedEvents.map((event) => ({
				// Ad-hoc entries carry no event reference.
				eventId: event.isCustom ? null : event.id,
				title: event.title,
				userId,
				formResponses: finalFormResponsesByEvent[event.id] || {},
			})),
		};

		await onSubmit(timeEntry.id, submission);

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

		/*
		 * v1 minted ids as `custom-...` while every consumer filtered on
		 * `custom_`, so ad-hoc entries were never recognised as such. The id is
		 * now local-only — what persists is `eventId: null`.
		 */
		const newEvent = {
			id: `custom_${Date.now()}`,
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
		// progress is per-upload in v2; nothing to reset
	};

	if (!timeEntry || !visible) return null;

	return (
		<BottomSheet
			ref={bottomSheetRef}
			snapPoints={snapPoints}
			enablePanDownToClose
			onClose={handleClosePress}
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
								timeEntry.clockInAt.toDate(),
								"EEEE, MMMM d, yyyy",
							)}
						</Text>
					</View>

					<View style={styles.detailRow}>
						<Text style={styles.detailLabel}>Time:</Text>
						<Text style={styles.detailValue}>
							{format(timeEntry.clockInAt.toDate(), "h:mm a")} -{" "}
							{timeEntry.clockOutAt
								? format(
										timeEntry.clockOutAt.toDate(),
										"h:mm a",
									)
								: "Now"}
						</Text>
					</View>

					{timeEntry.workedSeconds && (
						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>Duration:</Text>
							<Text style={styles.detailValue}>
								{formatDuration(timeEntry.workedSeconds)}
							</Text>
						</View>
					)}
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
							(isSubmitting || !isFormReady) &&
								styles.disabledButton,
						]}
						onPress={handleSubmit}
						disabled={isSubmitting || !isFormReady}
					>
						{isSubmitting || !isFormReady ? (
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
