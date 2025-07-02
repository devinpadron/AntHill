import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useState,
	useRef,
} from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert,
} from "react-native";
import BottomSheet, {
	BottomSheetScrollView,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { BottomSheetMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import DatePicker from "react-native-date-picker";
import { format, differenceInSeconds } from "date-fns";
import { useUser } from "../../contexts/UserContext";
import CustomFormRender from "./CustomFormRender";
import { useUploadManager } from "../../contexts/UploadManagerContext";
import { AttachmentItem } from "../../types";

// Update the interface for component props
interface EditSheetProps {
	visible: boolean;
	snapPoints?: string[];
	timeEntry?: any;
	editNotes: string;
	editChangeSummary: string;
	setEditNotes: (value: string) => void;
	setEditChangeSummary: (value: string) => void;
	onClose: () => void;
	onSave: (updates: any) => void;
	onDelete?: (timeEntryId: string) => void;
}

// Use forwardRef with proper typing
const EditSheet = forwardRef<BottomSheetMethods, EditSheetProps>(
	(
		{
			snapPoints = ["85%"],
			timeEntry,
			editNotes,
			editChangeSummary,
			setEditNotes,
			setEditChangeSummary,
			onClose,
			onSave,
			onDelete,
		},
		ref,
	) => {
		// Create a local ref that we know is always an object ref
		const bottomSheetRef = React.useRef<BottomSheet>(null);

		// Add refs for text inputs
		const bottomSheetScrollViewRef = useRef(null);
		const summaryInputRef = useRef<typeof BottomSheetTextInput>(null);

		// Local state for time inputs
		const [clockInDate, setClockInDate] = useState(new Date());
		const [clockOutDate, setClockOutDate] = useState(new Date());
		const [showInPicker, setShowInPicker] = useState(false);
		const [showOutPicker, setShowOutPicker] = useState(false);
		const [formResponses, setFormResponses] = useState<any>({});
		const { uploadFiles, deleteFiles, uploadProgress } = useUploadManager();
		const customForm = timeEntry?.generalForm || null;
		const eventForm = timeEntry?.eventForm || null;
		const { isAdmin } = useUser();

		const [filesToUpload, setFilesToUpload] = useState<{
			[fieldId: string]: AttachmentItem[];
		}>({});
		const [deletionQueue, setDeletionQueue] = useState<string[]>([]);

		// State for form errors
		const [formErrors, setFormErrors] = useState<Record<string, string>>(
			{},
		);
		const [formState, setFormState] = useState(customForm);

		// Add these state variables near other state declarations
		const [pauseDurationHours, setPauseDurationHours] = useState("0");
		const [pauseDurationMinutes, setPauseDurationMinutes] = useState("0");

		// Add this near other state declarations
		const [connectedEventResponses, setConnectedEventResponses] = useState<{
			[eventId: string]: any;
		}>({});
		const [eventFormState, setEventFormState] = useState(eventForm);
		const [eventFormErrors, setEventFormErrors] = useState<
			Record<string, Record<string, string>>
		>({});

		// Add this near other state declarations
		const [localConnectedEvents, setLocalConnectedEvents] = useState<any[]>(
			[],
		);

		const { userId, user } = useUser();

		// Calculate duration based on clock in/out times
		const calculateDuration = (): number => {
			if (!clockInDate || !clockOutDate) return 0;
			return Math.max(0, differenceInSeconds(clockOutDate, clockInDate));
		};

		// Forward the methods from our local ref to the forwarded ref
		useImperativeHandle(
			ref,
			() => bottomSheetRef.current as BottomSheetMethods,
		);

		// Initialize form data when timeEntry changes
		useEffect(() => {
			if (timeEntry) {
				// Set clock times
				setClockInDate(new Date(timeEntry.clockInTime));
				setClockOutDate(
					timeEntry.clockOutTime
						? new Date(timeEntry.clockOutTime)
						: new Date(),
				);

				// Initialize form responses
				if (timeEntry.formResponses) {
					setFormResponses({ ...timeEntry.formResponses });
				}

				// Initialize local connected events
				if (
					timeEntry.connectedEvents &&
					timeEntry.connectedEvents.length > 0
				) {
					setLocalConnectedEvents([...timeEntry.connectedEvents]);

					const eventResponses = {};
					timeEntry.connectedEvents.forEach((event) => {
						if (event.formResponses) {
							eventResponses[event.eventId] = {
								...event.formResponses,
							};
						}
					});
					setConnectedEventResponses(eventResponses);
				} else {
					setLocalConnectedEvents([]);
				}

				// Initialize pause duration
				if (timeEntry.totalPausedSeconds) {
					const hours = Math.floor(
						timeEntry.totalPausedSeconds / 3600,
					);
					const minutes = Math.floor(
						(timeEntry.totalPausedSeconds % 3600) / 60,
					);
					setPauseDurationHours(hours.toString());
					setPauseDurationMinutes(minutes.toString());
				} else {
					setPauseDurationHours("0");
					setPauseDurationMinutes("0");
				}
			}
		}, [timeEntry]);

		// Initialize form state when customForm changes
		useEffect(() => {
			if (customForm) {
				// Initialize form with isOpen and showPicker properties
				const updatedFields = customForm.fields.map((field) => ({
					...field,
					isOpen: false,
					showPicker: false,
				}));
				setFormState({ ...customForm, fields: updatedFields });
			}
		}, [customForm]);

		// Add a useEffect for eventForm initialization
		useEffect(() => {
			if (eventForm) {
				// Initialize event form with isOpen and showPicker properties
				const updatedFields = eventForm.fields.map((field) => ({
					...field,
					isOpen: false,
					showPicker: false,
				}));
				setEventFormState({ ...eventForm, fields: updatedFields });
			}
		}, [eventForm]);

		const validateFormResponses = () => {
			const errors: Record<string, string> = {};

			if (customForm && customForm.fields) {
				customForm.fields.forEach((field) => {
					if (
						field.required &&
						(!formResponses[field.id] ||
							formResponses[field.id] === "")
					) {
						errors[field.id] = `${field.label} is required`;
					}
				});
			}

			setFormErrors(errors);
			return Object.keys(errors).length === 0;
		};

		// New validation function for event form responses
		const validateEventFormResponses = () => {
			const errors: Record<string, Record<string, string>> = {};
			let isValid = true;

			if (timeEntry?.connectedEvents && eventForm && eventForm.fields) {
				timeEntry.connectedEvents.forEach((event) => {
					const eventId = event.eventId;
					const eventErrors: Record<string, string> = {};

					eventForm.fields.forEach((field) => {
						if (
							field.required &&
							(!connectedEventResponses[eventId]?.[field.id] ||
								connectedEventResponses[eventId]?.[field.id] ===
									"")
						) {
							eventErrors[field.id] =
								`${field.label} is required`;
							isValid = false;
						}
					});

					if (Object.keys(eventErrors).length > 0) {
						errors[eventId] = eventErrors;
					}
				});
			}

			setEventFormErrors(errors);
			return isValid;
		};

		// Handle form response changes
		const handleFormResponseChange = (
			fieldId: string,
			fieldType,
			value: any,
		) => {
			setFormResponses((prev) => ({
				...prev,
				[fieldId]: value,
			}));

			// If this is a document or media field, track files that need uploading
			if (fieldType === "document" || fieldType === "media") {
				if (Array.isArray(value)) {
					// Find files that don't have a downloadUrl (new uploads)
					const newFiles = value.filter(
						(file) => !file.downloadUrl && !file.url,
					);

					if (newFiles.length > 0) {
						setFilesToUpload((prev) => ({
							...prev,
							[fieldId]: newFiles,
						}));
					}
				}
			}
		};

		// Handle event form response changes
		const handleEventFormResponseChange = (
			eventId: string,
			fieldId: string,
			fieldType: string,
			value: any,
		) => {
			setConnectedEventResponses((prev) => ({
				...prev,
				[eventId]: {
					...(prev[eventId] || {}),
					[fieldId]: value,
				},
			}));

			// If this is a document or media field, track files that need uploading
			if (fieldType === "document" || fieldType === "media") {
				if (Array.isArray(value)) {
					// Find files that don't have a downloadUrl (new uploads)
					const newFiles = value.filter(
						(file) => !file.downloadUrl && !file.url,
					);

					if (newFiles.length > 0) {
						setFilesToUpload((prev) => ({
							...prev,
							[`event_${eventId}_${fieldId}`]: newFiles,
						}));
					}
				}
			}
		};

		// Handle save with all updated values
		const handleSaveChanges = async () => {
			if (!editChangeSummary.trim() && !isAdmin) {
				Alert.alert("Required", "Please provide a summary of changes");
				return;
			}

			const duration = calculateDuration();
			if (duration <= 0) {
				Alert.alert(
					"Invalid Time",
					"Clock out time must be after clock in time",
				);
				return;
			}

			const pauseDuration = calculatePauseDuration();

			// Validate form responses
			if (!isAdmin) {
				const isFormValid = validateFormResponses();
				const isEventFormValid = validateEventFormResponses();
				if (!isFormValid || !isEventFormValid) {
					Alert.alert(
						"Required Fields",
						"Please fill out all required fields",
					);
					return;
				}
			}

			try {
				// First process deletions if there are any files in the deletion queue
				if (deletionQueue.length > 0) {
					try {
						await deleteFiles(
							deletionQueue,
							user.loggedInCompany,
							timeEntry.id,
							"TimeEntries",
						);
						console.log(`Deleted ${deletionQueue.length} files`);
					} catch (deleteError) {
						console.error("Error deleting files:", deleteError);
						Alert.alert(
							"Warning",
							"Some files could not be deleted. Continuing with save.",
						);
					}
				}

				// Process uploads if there are any new files to upload
				const pendingUploads = Object.values(filesToUpload).flat();
				let updatedFormResponses = { ...formResponses };

				if (pendingUploads.length > 0) {
					try {
						// Create temporary IDs for files if they don't have them
						const filesWithIds = pendingUploads.map((file) => ({
							...file,
							id:
								file.id ||
								`file-${Date.now()}-${Math.random()
									.toString(36)
									.substring(2, 9)}`,
						}));

						// Upload the files
						const uploadedFiles = await uploadFiles(
							filesWithIds,
							user.loggedInCompany,
							timeEntry.id,
							"TimeEntries",
						);

						// Update form responses with uploaded file references
						Object.keys(filesToUpload).forEach((fieldId) => {
							const fieldFiles = [
								...(formResponses[fieldId] || []),
							];

							// Replace local files with uploaded versions
							const updatedFiles = fieldFiles.map((file) => {
								// Check if this is a file that was just uploaded
								const uploadedFile = uploadedFiles.find(
									(u) =>
										file.uri === u.uri ||
										(file.id && file.id === u.id),
								);
								return uploadedFile || file;
							});

							updatedFormResponses[fieldId] = updatedFiles;
						});
					} catch (uploadError) {
						console.error("Error uploading files:", uploadError);
						Alert.alert(
							"Error",
							"Failed to upload some files. Please try again.",
						);
						return;
					}
				}

				// For fields with files, filter out any that were marked for deletion
				if (customForm && customForm.fields) {
					customForm.fields.forEach((field) => {
						if (
							(field.type === "document" ||
								field.type === "media") &&
							updatedFormResponses[field.id]
						) {
							const files = updatedFormResponses[field.id];
							if (Array.isArray(files)) {
								// Filter out files that are in the deletion queue
								updatedFormResponses[field.id] = files.filter(
									(file) => {
										const fileId = file.id || file.path;
										const fileInDeletionQueue =
											fileId &&
											deletionQueue.includes(fileId);

										// Also check if thumbnail is in deletion queue
										const thumbnailInDeletionQueue =
											file.thumbnailPath &&
											deletionQueue.includes(
												file.thumbnailPath,
											);

										return (
											!fileInDeletionQueue &&
											!thumbnailInDeletionQueue
										);
									},
								);
							}
						}
					});
				}

				const updates = {
					...timeEntry,
					notes: editNotes,
					clockInTime: clockInDate.toISOString(),
					clockOutTime: clockOutDate.toISOString(),
					duration: duration - pauseDuration,
					totalPausedSeconds: pauseDuration, // Add this line
					formResponses: updatedFormResponses,
					connectedEvents: localConnectedEvents.map((event) => ({
						...event,
						formResponses:
							connectedEventResponses[event.eventId] || {},
					})),
					status: "edited",
					editHistory: timeEntry.editHistory
						? [
								...timeEntry.editHistory,
								{
									timestamp: new Date().toISOString(),
									editor: {
										userId: userId,
										displayName:
											user.firstName +
											" " +
											user.lastName,
									},
									summary: editChangeSummary,
									previousClockInTime: timeEntry.clockInTime,
									previousClockOutTime:
										timeEntry.clockOutTime,
									previousDuration: timeEntry.duration,
									previousNotes: timeEntry.notes,
									previousFormResponses:
										timeEntry.formResponses,
								},
							]
						: [
								{
									timestamp: new Date().toISOString(),
									editor: {
										userId: userId,
										displayName:
											user.firstName +
											" " +
											user.lastName,
									},
									summary: editChangeSummary,
									previousClockInTime: timeEntry.clockInTime,
									previousClockOutTime:
										timeEntry.clockOutTime,
									previousDuration: timeEntry.duration,
									previousNotes: timeEntry.notes,
									previousFormResponses:
										timeEntry.formResponses,
								},
							],
				};

				// Reset tracking states
				setFilesToUpload({});
				setDeletionQueue([]);

				// Save the updated entry
				onSave(updates);
			} catch (error) {
				console.error("Error saving changes:", error);
				Alert.alert(
					"Error",
					"Failed to save changes. Please try again.",
				);
			}
		};

		// Add this helper function
		const calculatePauseDuration = (): number => {
			const hours = parseInt(pauseDurationHours) || 0;
			const minutes = parseInt(pauseDurationMinutes) || 0;
			return hours * 3600 + minutes * 60;
		};

		// Add this function inside the EditSheet component
		const handleDeletePress = () => {
			onDelete(timeEntry.id);
			onClose();
		};

		// Add a function to handle focus on the summary field
		const handleSummaryFocus = () => {
			// Wait for keyboard to appear, then scroll to input
			setTimeout(() => {
				if (bottomSheetScrollViewRef.current) {
					bottomSheetScrollViewRef.current.scrollToEnd({
						animated: true,
					});
				}
			}, 300);
		};

		// Add this inside the EditSheet component
		const handleAddConnectedEvent = () => {
			const newEventId = `new-event-${Date.now()}`;
			const newEvent = {
				eventId: newEventId,
				eventTitle: "New Event",
				formResponses: {},
			};

			setLocalConnectedEvents((prev) => [...prev, newEvent]);
			setConnectedEventResponses((prev) => ({
				...prev,
				[newEventId]: {},
			}));
		};

		const handleDeleteConnectedEvent = (eventId) => {
			// Filter out the event to be deleted
			setLocalConnectedEvents((prev) =>
				prev.filter((event) => event.eventId !== eventId),
			);

			// Remove form responses for this event
			setConnectedEventResponses((prev) => {
				const updatedResponses = { ...prev };
				delete updatedResponses[eventId];
				return updatedResponses;
			});
		};

		const handleEventTitleChange = (eventId, newTitle) => {
			setLocalConnectedEvents((prev) =>
				prev.map((event) =>
					event.eventId === eventId
						? { ...event, eventTitle: newTitle }
						: event,
				),
			);
		};

		return (
			<BottomSheet
				ref={bottomSheetRef}
				snapPoints={snapPoints}
				enablePanDownToClose={true}
				onClose={onClose}
				backgroundStyle={styles.sheetBackground}
				handleIndicatorStyle={styles.sheetIndicator}
				index={-1}
				keyboardBehavior="extend"
				android_keyboardInputMode="adjustResize"
			>
				<View style={styles.sheetHeader}>
					<Text style={styles.modalTitle}>Edit Time Entry</Text>
				</View>

				<BottomSheetScrollView
					ref={bottomSheetScrollViewRef}
					contentContainerStyle={styles.sheetContent}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="interactive"
					showsVerticalScrollIndicator={true}
				>
					<View style={styles.modalForm}>
						{/* Time Selection Section */}
						<View style={styles.timeSection}>
							<Text style={styles.sectionTitle}>
								Time Details
							</Text>

							{/* Clock In Time */}
							<View style={styles.timeRow}>
								<Text style={styles.modalLabel}>
									Clock In Time
								</Text>
								<TouchableOpacity
									style={styles.timePickerButton}
									onPress={() => setShowInPicker(true)}
								>
									<Text style={styles.timePickerText}>
										{format(
											clockInDate,
											"MMM d, yyyy h:mm a",
										)}
									</Text>
									<Icon
										name="clock-outline"
										size={20}
										color="#007AFF"
									/>
								</TouchableOpacity>
								<DatePicker
									modal
									open={showInPicker}
									date={clockInDate}
									mode="datetime"
									onConfirm={(date) => {
										setShowInPicker(false);
										setClockInDate(date);

										// If clock out is earlier than clock in, adjust it
										if (clockOutDate < date) {
											setClockOutDate(
												new Date(
													date.getTime() + 3600000,
												),
											); // Add 1 hour
										}
									}}
									onCancel={() => setShowInPicker(false)}
								/>
							</View>

							{/* Clock Out Time */}
							<View style={styles.timeRow}>
								<Text style={styles.modalLabel}>
									Clock Out Time
								</Text>
								<TouchableOpacity
									style={styles.timePickerButton}
									onPress={() => setShowOutPicker(true)}
								>
									<Text style={styles.timePickerText}>
										{format(
											clockOutDate,
											"MMM d, yyyy h:mm a",
										)}
									</Text>
									<Icon
										name="clock-outline"
										size={20}
										color="#007AFF"
									/>
								</TouchableOpacity>
								<DatePicker
									modal
									open={showOutPicker}
									date={clockOutDate}
									mode="datetime"
									onConfirm={(date) => {
										setShowOutPicker(false);
										setClockOutDate(date);
									}}
									onCancel={() => setShowOutPicker(false)}
								/>
							</View>

							{/* Duration (calculated, read-only) */}
							<View style={styles.durationRow}>
								<Text style={styles.modalLabel}>Duration</Text>
								<Text style={styles.durationText}>
									{Math.floor(calculateDuration() / 3600)}h{" "}
									{Math.floor(
										(calculateDuration() % 3600) / 60,
									)}
									m ({(calculateDuration() / 3600).toFixed(2)}{" "}
									hrs)
								</Text>
							</View>

							{/* Pause Duration (editable) */}
							<View style={styles.pauseDurationRow}>
								<Text style={styles.modalLabel}>
									Pause Duration
								</Text>
								<View
									style={styles.pauseDurationInputContainer}
								>
									<View
										style={styles.pauseDurationInputWrapper}
									>
										<TextInput
											style={styles.pauseDurationInput}
											keyboardType="number-pad"
											value={pauseDurationHours}
											onChangeText={setPauseDurationHours}
											maxLength={2}
										/>
										<Text style={styles.pauseDurationUnit}>
											h
										</Text>
									</View>
									<View
										style={styles.pauseDurationInputWrapper}
									>
										<TextInput
											style={styles.pauseDurationInput}
											keyboardType="number-pad"
											value={pauseDurationMinutes}
											onChangeText={(text) => {
												// Ensure minutes don't exceed 59
												const mins =
													parseInt(text) || 0;
												if (mins <= 59) {
													setPauseDurationMinutes(
														text,
													);
												} else {
													setPauseDurationMinutes(
														"59",
													);
												}
											}}
											maxLength={2}
										/>
										<Text style={styles.pauseDurationUnit}>
											m
										</Text>
									</View>
								</View>
							</View>
						</View>

						{/* Notes Section */}
						<View style={styles.notesSection}>
							<Text style={styles.sectionTitle}>Notes</Text>
							<TextInput
								style={styles.modalTextArea}
								multiline
								numberOfLines={4}
								placeholder="Enter notes for this time entry"
								value={editNotes}
								onChangeText={setEditNotes}
							/>
						</View>

						{/* Connected Events Section */}
						{eventForm && (
							<View style={styles.connectedEventsSection}>
								<Text style={styles.sectionTitle}>
									Connected Events
								</Text>

								{localConnectedEvents.map((event, index) => (
									<View
										key={event.eventId || index}
										style={styles.formSection}
									>
										<View
											style={styles.connectedEventHeader}
										>
											<Icon
												name="calendar-check"
												size={18}
												color="#007AFF"
											/>

											{/* Editable Event Title */}
											<View
												style={
													styles.eventTitleContainer
												}
											>
												<TextInput
													style={
														styles.eventTitleInput
													}
													value={
														event.eventTitle ??
														"Connected Event"
													} // Change || to ??
													onChangeText={(text) =>
														handleEventTitleChange(
															event.eventId,
															text,
														)
													}
													placeholder="Event Title"
												/>
											</View>

											{/* Delete Button (only show if more than one event) */}
											{localConnectedEvents.length >
												1 && (
												<TouchableOpacity
													style={
														styles.deleteEventButton
													}
													onPress={() =>
														handleDeleteConnectedEvent(
															event.eventId,
														)
													}
												>
													<Icon
														name="close-circle"
														size={20}
														color="#FF3B30"
													/>
												</TouchableOpacity>
											)}
										</View>

										{/* Event Form Responses */}
										<CustomFormRender
											customForm={eventFormState}
											formResponses={
												connectedEventResponses[
													event.eventId
												] || {}
											}
											formErrors={
												eventFormErrors[
													event.eventId
												] || {}
											}
											onFieldChange={(
												fieldId,
												fieldType,
												value,
											) =>
												handleEventFormResponseChange(
													event.eventId,
													fieldId,
													fieldType,
													value,
												)
											}
											setCustomForm={setEventFormState}
											uploadProgress={uploadProgress}
											deletionQueue={deletionQueue}
											setDeletionQueue={setDeletionQueue}
										/>
									</View>
								))}

								{/* Add Event Button */}
								<TouchableOpacity
									style={styles.addEventButton}
									onPress={handleAddConnectedEvent}
								>
									<Icon
										name="plus-circle"
										size={18}
										color="#007AFF"
									/>
									<Text style={styles.addEventButtonText}>
										Add Connected Event
									</Text>
								</TouchableOpacity>
							</View>
						)}

						{/* Form Responses Section */}
						{customForm && (
							<View style={styles.formSection}>
								<Text style={styles.sectionTitle}>
									Form Responses
								</Text>
								<CustomFormRender
									customForm={formState}
									formResponses={formResponses}
									formErrors={formErrors}
									onFieldChange={handleFormResponseChange}
									setCustomForm={setFormState}
									uploadProgress={uploadProgress}
									deletionQueue={deletionQueue}
									setDeletionQueue={setDeletionQueue}
								/>
							</View>
						)}

						{/* Change Summary */}
						<View style={styles.summarySection}>
							<Text
								style={[
									styles.sectionTitle,
									{ marginBottom: 4 },
								]}
							>
								Change Summary{" "}
								{!isAdmin && (
									<Text style={styles.requiredMark}>*</Text>
								)}
							</Text>
							<Text style={styles.summarySubtitle}>
								Explain what changes were made and why
							</Text>
							<BottomSheetTextInput
								ref={summaryInputRef}
								style={styles.modalTextArea}
								multiline
								numberOfLines={3}
								placeholder="Required: Explain what changes were made and why"
								value={editChangeSummary}
								onChangeText={setEditChangeSummary}
								onFocus={handleSummaryFocus}
							/>
						</View>
					</View>
					<View style={styles.modalButtons}>
						<TouchableOpacity
							style={[
								styles.modalButton,
								styles.modalCancelButton,
							]}
							onPress={onClose}
						>
							<Text style={styles.modalCancelButtonText}>
								Cancel
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.modalButton, styles.modalSaveButton]}
							onPress={handleSaveChanges}
						>
							<Text style={styles.modalSaveButtonText}>
								Save Changes
							</Text>
						</TouchableOpacity>
					</View>

					{onDelete && (
						<View style={styles.deleteButtonContainer}>
							<TouchableOpacity
								style={styles.deleteButton}
								onPress={handleDeletePress}
							>
								<Icon
									name="delete-outline"
									size={20}
									color="#fff"
								/>
								<Text style={styles.deleteButtonText}>
									Delete Time Entry
								</Text>
							</TouchableOpacity>
						</View>
					)}
				</BottomSheetScrollView>
			</BottomSheet>
		);
	},
);

// Don't forget to add displayName for better debugging
EditSheet.displayName = "EditSheet";

const styles = StyleSheet.create({
	sheetBackground: {
		backgroundColor: "white",
	},
	sheetIndicator: {
		backgroundColor: "#ccc",
		width: 40,
		height: 4,
	},
	sheetHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	sheetContent: {
		padding: 20,
		paddingBottom: 40,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		flex: 1,
		textAlign: "center",
	},
	modalForm: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: "#333",
		marginBottom: 12,
	},
	timeSection: {
		marginBottom: 24,
		backgroundColor: "#f9f9f9",
		padding: 16,
		borderRadius: 12,
	},
	notesSection: {
		marginBottom: 24,
	},
	formSection: {
		marginBottom: 24,
		backgroundColor: "#f9f9f9",
		padding: 16,
		borderRadius: 12,
	},
	connectedEventsSection: {
		marginBottom: 24,
	},
	connectedEventCard: {
		marginBottom: 16,
		backgroundColor: "#f9f9f9",
		padding: 16,
		borderRadius: 12,
		borderLeftWidth: 3,
		borderLeftColor: "#007AFF",
	},
	connectedEventHeader: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
		paddingBottom: 8,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
	},
	connectedEventTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginLeft: 8,
	},
	summarySection: {
		marginBottom: 16,
	},
	summarySubtitle: {
		fontSize: 14,
		color: "#666",
		marginBottom: 8,
	},
	timeRow: {
		marginBottom: 16,
	},
	durationRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: 8,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#eee",
	},
	durationText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	modalLabel: {
		fontSize: 15,
		fontWeight: "500",
		color: "#333",
		marginBottom: 8,
	},
	timePickerButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		height: 44,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		backgroundColor: "#fff",
	},
	timePickerText: {
		fontSize: 16,
		color: "#333",
	},
	datePickerButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		height: 44,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		backgroundColor: "#fff",
	},
	datePickerText: {
		fontSize: 16,
		color: "#333",
	},
	modalInput: {
		height: 44,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		marginBottom: 16,
		backgroundColor: "#fff",
	},
	modalTextArea: {
		minHeight: 100,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingTop: 12,
		paddingBottom: 12,
		fontSize: 16,
		textAlignVertical: "top",
		backgroundColor: "#fff",
	},
	formField: {
		marginBottom: 16,
	},
	fieldLabel: {
		fontSize: 15,
		fontWeight: "500",
		color: "#333",
		marginBottom: 8,
	},
	formInput: {
		height: 44,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		backgroundColor: "#fff",
	},
	dropdownContainer: {
		zIndex: 1000,
		marginBottom: 16,
	},
	dropdown: {
		borderColor: "#ddd",
		backgroundColor: "#fff",
	},
	dropdownList: {
		borderColor: "#ddd",
	},
	requiredMark: {
		color: "#FF3B30",
		fontWeight: "bold",
	},
	modalButtons: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	modalButton: {
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		flex: 1,
	},
	modalCancelButton: {
		backgroundColor: "#f2f2f2",
		marginRight: 8,
	},
	modalSaveButton: {
		backgroundColor: "#007AFF",
		marginLeft: 8,
	},
	modalCancelButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#666",
	},
	modalSaveButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
	},
	deleteButtonContainer: {
		marginTop: 16,
		alignItems: "center",
	},
	deleteButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#FF3B30",
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 8,
	},
	deleteButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
		marginLeft: 8,
	},
	fieldAttachmentContainer: {
		marginTop: 8,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: "#eee",
		borderRadius: 8,
		padding: 12,
		backgroundColor: "#fff",
	},
	eventTitleContainer: {
		flex: 1,
		marginLeft: 8,
	},
	eventTitleInput: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		padding: 0,
	},
	deleteEventButton: {
		padding: 4,
	},
	addEventButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f0f8ff",
		padding: 12,
		borderRadius: 8,
		justifyContent: "center",
		marginTop: 8,
	},
	addEventButtonText: {
		color: "#007AFF",
		fontWeight: "600",
		fontSize: 15,
		marginLeft: 8,
	},
	pauseDurationRow: {
		marginTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#eee",
		paddingTop: 12,
	},
	pauseDurationInputContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 8,
	},
	pauseDurationInputWrapper: {
		flexDirection: "row",
		alignItems: "center",
		marginRight: 16,
	},
	pauseDurationInput: {
		width: 50,
		height: 44,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		backgroundColor: "#fff",
		textAlign: "center",
	},
	pauseDurationUnit: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginLeft: 8,
	},
});

export default EditSheet;
