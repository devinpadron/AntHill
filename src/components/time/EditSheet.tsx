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
	Dimensions,
	Switch,
	Platform,
	Alert,
	Keyboard,
} from "react-native";
import BottomSheet, {
	BottomSheetScrollView,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import Icon from "react-native-vector-icons/MaterialIcons";
import { BottomSheetMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import DatePicker from "react-native-date-picker";
import DropDownPicker from "react-native-dropdown-picker";
import { format, differenceInSeconds } from "date-fns";
import { useUser } from "../../contexts/UserContext";
import { AttachmentUploader } from "../eventSubmit/AttachmentUploader";
import { FileUpload } from "../../types";
import { uploadFile } from "../../utils/fileUtils";
import { deleteTimeEntryAttachments } from "../../services/timeEntryService";

// Define interface for component props
interface EditSheetProps {
	visible: boolean;
	snapPoints?: string[];
	timeEntry?: any;
	customForm?: any;
	editNotes: string;
	editChangeSummary: string;
	setEditNotes: (value: string) => void;
	setEditChangeSummary: (value: string) => void;
	onClose: () => void;
	onSave: (updates: any) => void;
	onDelete?: (timeEntryId: string) => void; // Add this new prop
}

// Use forwardRef with proper typing
const EditSheet = forwardRef<BottomSheetMethods, EditSheetProps>(
	(
		{
			visible,
			snapPoints = ["85%"],
			timeEntry,
			customForm,
			editNotes,
			editChangeSummary,
			setEditNotes,
			setEditChangeSummary,
			onClose,
			onSave,
			onDelete, // Add this new prop
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
		const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
		const [uploadProgress, setUploadProgress] = useState<
			Record<string, number>
		>({});
		const [deletionQueue, setDeletionQueue] = useState<string[]>([]);

		const { userId, user } = useUser();

		// Dropdown states
		const [openDropdowns, setOpenDropdowns] = useState<{
			[key: string]: boolean;
		}>({});

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
			}
		}, [timeEntry]);

		// Handle sheet visibility using our local ref
		useEffect(() => {
			if (visible && bottomSheetRef.current) {
				bottomSheetRef.current.expand();
			} else if (!visible && bottomSheetRef.current) {
				bottomSheetRef.current.close();
			}
		}, [visible]);

		// Handle form response changes
		const handleFormResponseChange = (fieldId: string, value: any) => {
			setFormResponses((prev) => ({
				...prev,
				[fieldId]: value,
			}));
		};

		// Update this function to correctly check for file IDs
		const handleFileDelete = (fieldId: string, file: FileUpload) => {
			// Files from Firebase have either 'id' or are identified by their path/name
			if (file.path || file.id) {
				// Add the file identifier (path or id) to the deletion queue
				const fileIdentifier = file.id || file.path;
				const updatedDeletionQueue = [...deletionQueue, fileIdentifier];

				// Also add the thumbnail path if it exists (for videos/images)
				if (file.thumbnailPath) {
					updatedDeletionQueue.push(file.thumbnailPath);
					console.log(
						`Added thumbnail to deletion queue: ${file.thumbnailPath}`,
					);
				}

				setDeletionQueue(updatedDeletionQueue);
				console.log(`Added file to deletion queue: ${fileIdentifier}`);
			} else {
				// For new files that haven't been uploaded yet (only have URI)
				const updatedFiles = (formResponses[fieldId] || []).filter(
					(f: FileUpload) => f.uri !== file.uri,
				);
				handleFormResponseChange(fieldId, updatedFiles);
			}
		};

		// Also update the undelete handler
		const handleFileUndelete = (fieldId: string, file: FileUpload) => {
			const fileIdentifier = file.id || file.path;
			if (fileIdentifier) {
				// Remove both the file and its thumbnail (if exists) from deletion queue
				let updatedQueue = deletionQueue.filter(
					(id) => id !== fileIdentifier,
				);

				// Also remove thumbnail path if it exists
				if (file.thumbnailPath) {
					updatedQueue = updatedQueue.filter(
						(id) => id !== file.thumbnailPath,
					);
				}

				setDeletionQueue(updatedQueue);
			}
		};

		// Toggle dropdown open state
		const toggleDropdown = (
			fieldId: string,
			isOpenValue: React.SetStateAction<boolean>,
		) => {
			// Convert SetStateAction<boolean> to boolean
			const isOpen =
				typeof isOpenValue === "function"
					? isOpenValue(openDropdowns[fieldId] || false)
					: isOpenValue;

			setOpenDropdowns((prev) => {
				const newState = { ...prev };
				// Close all other dropdowns
				Object.keys(newState).forEach((key) => {
					newState[key] = key === fieldId ? isOpen : false;
				});
				return newState;
			});
		};

		// Handle save with all updated values
		const handleSaveChanges = async () => {
			if (!editChangeSummary.trim()) {
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

			try {
				// Process any new file uploads in custom form fields
				const newFormResponses = { ...formResponses };
				let hasFilesToUpload = false;
				const filesToUpload: {
					fieldId: string;
					files: FileUpload[];
				}[] = [];

				// Identify fields with new files to upload
				if (customForm && customForm.fields) {
					for (const field of customForm.fields) {
						if (
							(field.type === "document" ||
								field.type === "media") &&
							newFormResponses[field.id]
						) {
							// Filter out files in the deletion queue
							let files = newFormResponses[field.id];
							if (files && Array.isArray(files)) {
								// Remove files that are in the deletion queue
								files = files.filter((file) => {
									const fileIdentifier = file.id || file.path;
									return (
										!fileIdentifier ||
										!deletionQueue.includes(fileIdentifier)
									);
								});
								newFormResponses[field.id] = files;

								// Find files that need to be uploaded
								const newFiles = files.filter(
									(file) => !file.id && file.uri,
								);
								if (newFiles.length > 0) {
									hasFilesToUpload = true;
									filesToUpload.push({
										fieldId: field.id,
										files: newFiles,
									});
								}
							}
						}
					}
				}

				// If there are files in the deletion queue, delete them

				if (deletionQueue.length > 0) {
					try {
						await deleteTimeEntryAttachments(deletionQueue);
					} catch (error) {
						console.error("Error deleting attachments:", error);
					}
				}

				// Process uploads (existing code)
				if (hasFilesToUpload) {
					try {
						// Get all files that need to be uploaded
						const allFilesToUpload = filesToUpload.flatMap(
							(item) => item.files,
						);

						// Start tracking uploads
						setUploadingFiles(
							allFilesToUpload.map((file) => file.uri),
						);

						// Upload each file
						for (const fileGroup of filesToUpload) {
							const uploadedFiles = await Promise.all(
								fileGroup.files.map(async (file) => {
									try {
										const uploadedFile = await uploadFile(
											file,
											timeEntry.id, // Using time entry ID as reference
											user.loggedInCompany, // Assuming this is the company ID
											(uri, progress) => {
												setUploadProgress((prev) => ({
													...prev,
													[uri]: progress,
												}));
											},
										);
										return uploadedFile;
									} catch (error) {
										console.error(
											"Error uploading file:",
											error,
										);
										return file; // Return original file on error
									}
								}),
							);

							// Update form responses with uploaded files
							const existingFiles = newFormResponses[
								fileGroup.fieldId
							].filter((file) => file.id || file.url);
							newFormResponses[fileGroup.fieldId] = [
								...existingFiles,
								...uploadedFiles,
							];
						}
					} catch (error) {
						console.error("Error processing file uploads:", error);
						Alert.alert(
							"Error",
							"Failed to upload some files. Please try again.",
						);
						return;
					} finally {
						setUploadingFiles([]);
						setUploadProgress({});
					}
				}

				// Update the time entry with the updated form responses
				const updates = {
					notes: editNotes,
					clockInTime: clockInDate.toISOString(),
					clockOutTime: clockOutDate.toISOString(),
					duration: duration,
					formResponses: newFormResponses,
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

				onSave(updates);

				// Reset the deletion queue
				setDeletionQueue([]);
			} catch (error) {
				console.error("Error saving changes:", error);
				Alert.alert(
					"Error",
					"Failed to save changes. Please try again.",
				);
			}
		};

		// Add this function inside the EditSheet component
		const handleDeletePress = () => {
			Alert.alert(
				"Delete Time Entry",
				"Are you sure you want to delete this time entry? This action cannot be undone.",
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Delete",
						onPress: () => {
							if (onDelete && timeEntry?.id) {
								onDelete(timeEntry.id);
								onClose();
							}
						},
						style: "destructive",
					},
				],
			);
		};

		// Render form field based on type
		const renderFormField = (field: any) => {
			const value = formResponses[field.id];

			switch (field.type) {
				case "text":
					return (
						<TextInput
							style={styles.formInput}
							value={value?.toString() || ""}
							onChangeText={(text) =>
								handleFormResponseChange(field.id, text)
							}
							placeholder={
								field.placeholder ||
								`Enter ${field.label.toLowerCase()}`
							}
						/>
					);

				case "number":
					return (
						<TextInput
							style={styles.formInput}
							value={value?.toString() || ""}
							onChangeText={(text) =>
								handleFormResponseChange(field.id, text)
							}
							keyboardType="numeric"
							placeholder={
								field.placeholder ||
								`Enter ${field.label.toLowerCase()}`
							}
						/>
					);

				case "checkbox":
					return (
						<Switch
							value={value === true}
							onValueChange={(val) =>
								handleFormResponseChange(field.id, val)
							}
							trackColor={{ false: "#ddd", true: "#007AFF" }}
						/>
					);

				case "select":
					return (
						<View style={styles.dropdownContainer}>
							<DropDownPicker
								open={openDropdowns[field.id] || false}
								value={value || ""}
								items={(field.options || []).map(
									(option: string) => ({
										label: option,
										value: option,
									}),
								)}
								setOpen={(isOpen) =>
									toggleDropdown(field.id, isOpen)
								}
								setValue={(callback) => {
									const newValue =
										typeof callback === "function"
											? callback(value)
											: callback;
									handleFormResponseChange(
										field.id,
										newValue,
									);
								}}
								style={styles.dropdown}
								dropDownContainerStyle={styles.dropdownList}
								placeholder={
									field.placeholder ||
									`Select ${field.label.toLowerCase()}`
								}
								listMode="SCROLLVIEW"
								scrollViewProps={{
									nestedScrollEnabled: true,
								}}
							/>
						</View>
					);

				case "multiSelect":
					return (
						<View style={styles.dropdownContainer}>
							<DropDownPicker
								multiple={true}
								open={openDropdowns[field.id] || false}
								value={Array.isArray(value) ? value : []}
								items={(field.options || []).map(
									(option: string) => ({
										label: option,
										value: option,
									}),
								)}
								setOpen={(isOpen) =>
									toggleDropdown(field.id, isOpen)
								}
								setValue={(callback) => {
									const currentValues = Array.isArray(value)
										? [...value]
										: [];
									const newValues =
										typeof callback === "function"
											? callback(currentValues)
											: callback;
									handleFormResponseChange(
										field.id,
										Array.isArray(newValues)
											? newValues
											: [],
									);
								}}
								style={styles.dropdown}
								dropDownContainerStyle={styles.dropdownList}
								placeholder={
									field.placeholder ||
									`Select ${field.label.toLowerCase()}`
								}
								mode="BADGE"
								badgeColors={["#3d7eea"]}
								badgeTextStyle={{ color: "white" }}
								listMode="SCROLLVIEW"
								scrollViewProps={{
									nestedScrollEnabled: true,
								}}
							/>
						</View>
					);

				case "date":
				case "time":
					// For simplicity, I'm using the same picker for date/time fields
					// In a real app, you might want to handle these differently
					return (
						<>
							<TouchableOpacity
								style={styles.datePickerButton}
								onPress={() => {
									setOpenDropdowns((prev) => ({
										...prev,
										[`${field.id}_picker`]: true,
									}));
								}}
							>
								<Text style={styles.datePickerText}>
									{value
										? format(
												new Date(value),
												field.type === "date"
													? "MMM d, yyyy"
													: "h:mm a",
											)
										: "Select..."}
								</Text>
								<Icon
									name={
										field.type === "date"
											? "calendar-today"
											: "access-time"
									}
									size={20}
									color="#007AFF"
								/>
							</TouchableOpacity>
							<DatePicker
								modal
								open={!!openDropdowns[`${field.id}_picker`]}
								date={value ? new Date(value) : new Date()}
								mode={field.type === "date" ? "date" : "time"}
								onConfirm={(date) => {
									setOpenDropdowns((prev) => ({
										...prev,
										[`${field.id}_picker`]: false,
									}));
									handleFormResponseChange(
										field.id,
										date.toISOString(),
									);
								}}
								onCancel={() => {
									setOpenDropdowns((prev) => ({
										...prev,
										[`${field.id}_picker`]: false,
									}));
								}}
							/>
						</>
					);

				case "document":
					return (
						<View style={styles.fieldAttachmentContainer}>
							<AttachmentUploader
								files={value || []}
								onFilesAdded={(files) => {
									// Only accept documents (not images or videos)
									const docFiles = files.filter(
										(file) =>
											!file.type.startsWith("image/") &&
											!file.type.startsWith("video/"),
									);
									if (docFiles.length) {
										handleFormResponseChange(field.id, [
											...(value || []),
											...docFiles,
										]);
									}
								}}
								onFileDelete={(file) =>
									handleFileDelete(field.id, file)
								}
								onFileUndelete={(file) =>
									handleFileUndelete(field.id, file)
								}
								deletionQueue={deletionQueue}
								uploadingFiles={uploadingFiles}
								uploadProgress={uploadProgress}
								docOnly={true}
								deletionQueueType="path"
							/>
						</View>
					);

				case "media":
					return (
						<View style={styles.fieldAttachmentContainer}>
							<AttachmentUploader
								files={value || []}
								onFilesAdded={(files) => {
									// Only accept images and videos
									const mediaFiles = files.filter(
										(file) =>
											file.type.startsWith("image/") ||
											file.type.startsWith("video/"),
									);
									if (mediaFiles.length) {
										handleFormResponseChange(field.id, [
											...(value || []),
											...mediaFiles,
										]);
									}
								}}
								onFileDelete={(file) =>
									handleFileDelete(field.id, file)
								}
								onFileUndelete={(file) =>
									handleFileUndelete(field.id, file)
								}
								deletionQueue={deletionQueue}
								uploadingFiles={uploadingFiles}
								uploadProgress={uploadProgress}
								mediaOnly={true}
								deletionQueueType="path"
							/>
						</View>
					);

				default:
					return <Text>Unsupported field type: {field.type}</Text>;
			}
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
										name="access-time"
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
										name="access-time"
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

						{/* Form Responses Section */}
						{customForm &&
							customForm.fields &&
							customForm.fields.length > 0 && (
								<View style={styles.formSection}>
									<Text style={styles.sectionTitle}>
										Form Responses
									</Text>
									{customForm.fields.map((field: any) => (
										<View
											key={field.id}
											style={styles.formField}
										>
											<Text style={styles.fieldLabel}>
												{field.label}
												{field.required && (
													<Text
														style={
															styles.requiredMark
														}
													>
														*
													</Text>
												)}
											</Text>
											{renderFormField(field)}
										</View>
									))}
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
								<Text style={styles.requiredMark}>*</Text>
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
								blurOnSubmit={false}
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
});

export default EditSheet;
