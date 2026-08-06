import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useState,
	useRef,
} from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
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
import { getConnections } from "../../services/timeEntryEditService";
import type { SelectableAttachment } from "../ui/AttachmentsSelector";
import { editSheetStyles } from "./EditSheet.styles";
import { useTheme, useThemedStyles } from "../../theme";
import { FormSchema, TimeEntry } from "../../types";

// Update the interface for component props
interface EditSheetProps {
	visible: boolean;
	snapPoints?: string[];
	timeEntry?: TimeEntry;
	/** Resolved from timeEntry.formSchemaIds by the parent. */
	timeEntrySchema?: FormSchema | null;
	eventSchema?: FormSchema | null;
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
			timeEntrySchema = null,
			eventSchema = null,
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
		const theme = useTheme();
		/* react-native-date-picker defaults to "auto", which follows the SYSTEM
		   scheme — so a user who forces dark in-app got a light picker. */
		const pickerTheme = theme.isDark ? "dark" : "light";
		const styles = useThemedStyles(editSheetStyles);
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
		const { uploadFiles, deleteAttachments, uploadProgress } =
			useUploadManager();
		/*
		 * Resolved by the parent and passed down. v1 embedded a full copy of
		 * both schemas on every entry (`generalForm` / `eventForm`); v2 stores
		 * references, and reading the old names here yielded null, so the edit
		 * sheet silently rendered no form fields at all.
		 */
		const customForm = timeEntrySchema;
		const eventForm = eventSchema;
		const { isAdmin } = useUser();

		const [filesToUpload, setFilesToUpload] = useState<{
			[fieldId: string]: SelectableAttachment[];
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

		const { userId, user, companyId } = useUser();

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
				setClockInDate(timeEntry.clockInAt.toDate());
				setClockOutDate(
					timeEntry.clockOutAt
						? timeEntry.clockOutAt.toDate()
						: new Date(),
				);

				// Initialize form responses
				if (timeEntry.formResponses) {
					setFormResponses({ ...timeEntry.formResponses });
				}

				/*
				 * Initialize pause duration.
				 *
				 * Was `totalPausedSeconds`, a v1 field name that reads
				 * undefined on a current document — so opening the edit sheet
				 * always showed 0m paused, and saving wrote that zero back
				 * over the real value.
				 */
				if (timeEntry.pausedSeconds) {
					const hours = Math.floor(timeEntry.pausedSeconds / 3600);
					const minutes = Math.floor(
						(timeEntry.pausedSeconds % 3600) / 60,
					);
					setPauseDurationHours(hours.toString());
					setPauseDurationMinutes(minutes.toString());
				} else {
					setPauseDurationHours("0");
					setPauseDurationMinutes("0");
				}
			}
		}, [timeEntry]);

		/*
		 * Connections come from a subcollection.
		 *
		 * v1 read `timeEntry.connectedEvents`, which is undefined on a v2
		 * document — so the sheet opened with no connected events and silently
		 * discarded them on save.
		 */
		useEffect(() => {
			if (!timeEntry?.id) return;
			let cancelled = false;

			getConnections(timeEntry.id).then((loaded) => {
				if (cancelled || !loaded.length) return;

				/*
				 * Normalized to a local shape keyed on the connection's OWN id.
				 *
				 * Everything in this sheet used to key on `eventId`, which is
				 * NULL for a job the worker typed in rather than linked. Every
				 * ad-hoc connection on an entry therefore shared one bucket:
				 * renaming one renamed them all, deleting one deleted them all,
				 * and they overwrote each other's answers.
				 *
				 * The title is resolved once, here. The input read `eventTitle`
				 * — a field no connection document has — so every row showed the
				 * "Connected Event" placeholder instead of what the worker
				 * actually typed.
				 */
				setLocalConnectedEvents(
					loaded.map((connection) => ({
						id: connection.id,
						eventId: connection.eventId,
						title:
							connection.customTitle ||
							connection.eventTitleSnapshot ||
							"",
					})),
				);

				const eventResponses = {};
				loaded.forEach((connection) => {
					if (connection.formResponses) {
						eventResponses[connection.id] = {
							...connection.formResponses,
						};
					}
				});
				setConnectedEventResponses(eventResponses);
			});

			return () => {
				cancelled = true;
			};
		}, [timeEntry?.id]);

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

			if (localConnectedEvents.length && eventForm && eventForm.fields) {
				localConnectedEvents.forEach((event) => {
					const eventErrors: Record<string, string> = {};

					eventForm.fields.forEach((field) => {
						if (
							field.required &&
							(!connectedEventResponses[event.id]?.[field.id] ||
								connectedEventResponses[event.id]?.[
									field.id
								] === "")
						) {
							eventErrors[field.id] =
								`${field.label} is required`;
							isValid = false;
						}
					});

					if (Object.keys(eventErrors).length > 0) {
						errors[event.id] = eventErrors;
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
			connectionId: string,
			fieldId: string,
			fieldType: string,
			value: any,
		) => {
			setConnectedEventResponses((prev) => ({
				...prev,
				[connectionId]: {
					...(prev[connectionId] || {}),
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
							[`event_${connectionId}_${fieldId}`]: newFiles,
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
						await deleteAttachments(
							companyId,
							"timeEntry",
							timeEntry.id,
							deletionQueue,
						);
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
							companyId,
							"timeEntry",
							timeEntry.id,
							filesWithIds.map((f) => ({
								id: f.id,
								uri: f.displayUri,
								name: f.fileName,
								type: f.contentType,
								size: f.sizeBytes,
								width: f.width,
								height: f.height,
								thumbnailUri: f.thumbnailUri,
							})),
							userId,
						);

						// Update form responses with uploaded file references
						Object.keys(filesToUpload).forEach((fieldId) => {
							const fieldFiles = [
								...(formResponses[fieldId] || []),
							];

							// Answers hold attachment ids, not file objects.
							const updatedFiles = fieldFiles
								.map((file) => file.id)
								.filter((id) => uploadedFiles.includes(id));

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

				/*
				 * A PATCH plus a separate audit record.
				 *
				 * v1 spread `...timeEntry` from client state and appended to an
				 * `editHistory` array inline — a read-modify-write over an
				 * unbounded array, in one of three competing shapes, none of
				 * which the renderer actually read. The `before` snapshot below
				 * is the shape the edits subcollection stores.
				 */
				const updates = {
					patch: {
						notes: editNotes,
						clockInAt: clockInDate,
						clockOutAt: clockOutDate,
						workedSeconds: duration - pauseDuration,
						pausedSeconds: pauseDuration,
						formResponses: updatedFormResponses,
					},
					/*
					 * `title` is what is on screen, not the snapshot it was
					 * loaded from — reading `eventTitleSnapshot` here meant a
					 * retitled connection saved under its old name, so editing
					 * the title did nothing at all.
					 */
					connections: localConnectedEvents.map((event) => ({
						eventId: event.eventId ?? null,
						title: event.title ?? "",
						userId: timeEntry.userId,
						formResponses: connectedEventResponses[event.id] || {},
					})),
					edit: {
						summary: editChangeSummary,
						actorUserId: userId,
						actorDisplayName: `${user?.firstName ?? ""} ${
							user?.lastName ?? ""
						}`.trim(),
						before: {
							clockInAt: timeEntry.clockInAt ?? null,
							clockOutAt: timeEntry.clockOutAt ?? null,
							workedSeconds: timeEntry.workedSeconds ?? null,
							notes: timeEntry.notes ?? null,
							formResponses: timeEntry.formResponses ?? null,
						},
					},
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
			/*
			 * eventId stays NULL: this is an ad-hoc job the worker is typing
			 * in, not a link to a real event.
			 *
			 * It used to be given a made-up `new-event-<ts>` id, which
			 * setConnections took for a genuine event reference — it wrote the
			 * connection under that fake document id with `customTitle: null`,
			 * so the row was neither resolvable as an event nor recognisable as
			 * ad-hoc by the `custom_` checks downstream.
			 */
			const id = `custom_new_${Date.now()}`;

			setLocalConnectedEvents((prev) => [
				...prev,
				{ id, eventId: null, title: "" },
			]);
			setConnectedEventResponses((prev) => ({ ...prev, [id]: {} }));
		};

		const handleDeleteConnectedEvent = (connectionId) => {
			// Filter out the event to be deleted
			setLocalConnectedEvents((prev) =>
				prev.filter((event) => event.id !== connectionId),
			);

			// Remove form responses for this event
			setConnectedEventResponses((prev) => {
				const updatedResponses = { ...prev };
				delete updatedResponses[connectionId];
				return updatedResponses;
			});
		};

		const handleEventTitleChange = (connectionId, newTitle) => {
			setLocalConnectedEvents((prev) =>
				prev.map((event) =>
					event.id === connectionId
						? { ...event, title: newTitle }
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
										color={theme.colors.accent}
									/>
								</TouchableOpacity>
								<DatePicker
									modal
									open={showInPicker}
									date={clockInDate}
									mode="datetime"
									theme={pickerTheme}
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
										color={theme.colors.accent}
									/>
								</TouchableOpacity>
								<DatePicker
									modal
									open={showOutPicker}
									date={clockOutDate}
									mode="datetime"
									theme={pickerTheme}
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
								placeholderTextColor={theme.colors.textTertiary}
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

								{localConnectedEvents.map((event) => (
									<View
										key={event.id}
										style={styles.formSection}
									>
										<View
											style={styles.connectedEventHeader}
										>
											<Icon
												name="calendar-check"
												size={18}
												color={theme.colors.accent}
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
													value={event.title}
													onChangeText={(text) =>
														handleEventTitleChange(
															event.id,
															text,
														)
													}
													placeholderTextColor={
														theme.colors
															.textTertiary
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
															event.id,
														)
													}
												>
													<Icon
														name="close-circle"
														size={20}
														color={
															theme.colors.danger
														}
													/>
												</TouchableOpacity>
											)}
										</View>

										{/* Event Form Responses */}
										<CustomFormRender
											customForm={eventFormState}
											formResponses={
												connectedEventResponses[
													event.id
												] || {}
											}
											formErrors={
												eventFormErrors[event.id] || {}
											}
											onFieldChange={(
												fieldId,
												fieldType,
												value,
											) =>
												handleEventFormResponseChange(
													event.id,
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
										color={theme.colors.accent}
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
								placeholderTextColor={theme.colors.textTertiary}
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
									color={theme.colors.onAccent}
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

export default EditSheet;
