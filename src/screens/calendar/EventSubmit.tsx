import "react-native-get-random-values";
import React, { useRef, useEffect, useState } from "react";
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	TouchableOpacity,
	Alert,
	Platform,
	ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import DatePicker from "react-native-date-picker";
import DropDownPicker from "react-native-dropdown-picker";
import moment from "moment";
import { subscribeAllUsersInCompany } from "../../services/companyService";
import { getUser } from "../../services/userService";
import { useEventForm } from "../../hooks/useEventForm";
import { EventFormHeader } from "../../components/eventSubmit/EventFormHeader";
import { LocationInput } from "../../components/eventSubmit/LocationInput";
import { useUser } from "../../contexts/UserContext";
import { Button } from "../../components/ui/Button";
import AttachmentsSelector from "../../components/ui/AttachmentsSelector";
import { AttachmentItem } from "../../types";
import { useUploadManager } from "../../contexts/UploadManagerContext";
import { getEventAttachments } from "../../services/eventService";
import { get, set } from "lodash";

const EventSubmit = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const route = useRoute<any>();
	const eventId = route.params?.uid;
	const googlePlacesRef = useRef(null);

	// Use our custom hook for form state management
	const {
		// Form state
		title,
		setTitle,
		date,
		setDate,
		allDay,
		startTime,
		setStartTime,
		hasEndTime,
		endTime,
		setEndTime,
		locations,
		assignedWorkers,
		setAssignedWorkers,
		notes,
		setNotes,

		// UI state
		openSelect,
		openDate,
		openStartTime,
		openEndTime,
		isLoading,
		isEditing,
		availableWorkers,
		setAvailableWorkers,
		editingLabelForAddress,
		setEditingLabelForAddress,
		labelText,
		setLabelText,

		// Methods
		updateLocation,
		deleteLocation,
		setLocationLabel,
		toggleDatePicker,
		toggleAllDay,
		toggleEndTime,
		handleSubmit,
		handleDelete,
		hasFormChanged,
	} = useEventForm(navigation, eventId);

	const { companyId: currentCompany } = useUser();
	const { uploadFiles, deleteFiles, isUploading, uploadProgress } =
		useUploadManager();
	const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
	const [attachmentDeletionQueue, setAttachmentDeletionQueue] = useState<
		string[]
	>([]);

	// Add these at the top of your component
	const isMounted = useRef(true);

	// Add at the beginning of the component
	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	// Load available workers
	useEffect(() => {
		if (!currentCompany) return;

		const subscriber = subscribeAllUsersInCompany(
			currentCompany,
			async (snapshot) => {
				const workers = await Promise.all(
					snapshot.docs.map(async (doc) => {
						const userData = await getUser(doc.id);
						return {
							label: `${userData.firstName} ${userData.lastName}`,
							value: doc.id,
						};
					}),
				);
				setAvailableWorkers(workers);
			},
		);

		return () => subscriber();
	}, [currentCompany]);

	const formatDate = (date: Date) => moment(date).format("MMM D, YYYY");
	const formatTime = (time: Date, start: boolean = true) => {
		if (start) return moment(time).format("h:mm A");
		return moment(time).format("MMMM D, h:mm A");
	};

	// Load attachments if editing an event
	useEffect(() => {
		if (eventId) {
			const fetchAttachments = async () => {
				const attachments = await getEventAttachments(
					currentCompany,
					eventId,
				);

				setAttachments(attachments);
			};

			fetchAttachments();
		}
	}, [eventId, currentCompany]);

	const canSubmit = () => {
		if (hasFormChanged()) {
			return true;
		} else if (attachmentDeletionQueue.length > 0) {
			return true;
		}
		return false;
	};

	const handleBackPress = () => {
		if (hasFormChanged()) {
			Alert.alert(
				"Discard Changes?",
				"You have unsaved changes. Are you sure you want to go back?",
				[
					{
						text: "Keep Editing",
						style: "cancel",
					},
					{
						text: "Discard",
						style: "destructive",
						onPress: () => navigation.goBack(),
					},
				],
			);
		} else {
			navigation.goBack();
		}
	};

	const handleAttachmentSubmit = async () => {
		try {
			if (!isMounted.current) return;

			// First, create or update the event and get the ID
			const eventId = await handleSubmit();

			if (!eventId || !currentCompany) {
				Alert.alert(
					"Error",
					"Unable to save event information. Please try again.",
				);
				return;
			}

			// Validate attachments before proceeding
			const validAttachments = attachments.filter((att) =>
				att.uri
					? att.uri.startsWith("file://") ||
						att.uri.startsWith("http")
					: false,
			);

			if (validAttachments.length !== attachments.length) {
				console.warn(
					`Found ${
						attachments.length - validAttachments.length
					} invalid attachments`,
				);
			}

			// First delete any files in the deletion queue
			if (attachmentDeletionQueue.length > 0) {
				await deleteFiles(
					attachmentDeletionQueue,
					currentCompany,
					eventId,
					"Events",
				);
			}

			// Then upload any new files
			if (validAttachments.length > 0) {
				const uploadedAttachments = await uploadFiles(
					validAttachments,
					currentCompany,
					eventId,
					"Events",
				);

				// Update state with uploaded attachments (uncomment and fix this)
				if (uploadedAttachments && uploadedAttachments.length > 0) {
					const existingAttachments = attachments.filter(
						(att) => att.isExisting,
					);
					setAttachments([
						...existingAttachments,
						...uploadedAttachments,
					]);
				}
			}

			// Clear deletion queue
			setAttachmentDeletionQueue([]);

			// Only navigate after all operations are complete
			if (isMounted.current) {
				navigation.pop();
			}
		} catch (error) {
			console.error("Error handling attachments:", error);
			Alert.alert(
				"Upload Error",
				"There was an error uploading attachments. Please try again.",
			);
		}
	};

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<KeyboardAwareScrollView
				contentContainerStyle={styles.scrollContainer}
				nestedScrollEnabled={true}
				keyboardShouldPersistTaps="handled"
			>
				<EventFormHeader
					title={isEditing ? "Edit Event" : "Submit New Event"}
					onBack={handleBackPress}
				/>

				{/* Form Container */}
				<View style={styles.formCard}>
					{/* Title Section */}
					<View style={styles.sectionContainer}>
						<Text style={styles.sectionTitle}>Event Details</Text>
						<View style={styles.inputContainer}>
							<Text style={styles.label}>Title</Text>
							<TextInput
								style={styles.input}
								placeholder="Enter Title"
								value={title}
								onChangeText={setTitle}
								placeholderTextColor="#A0A0A0"
							/>
						</View>

						{/* Location Section */}
						<LocationInput
							locations={locations}
							onLocationSelect={updateLocation}
							onLocationDelete={deleteLocation}
							onLabelChange={setLocationLabel}
							editingLabelForAddress={editingLabelForAddress}
							setEditingLabelForAddress={
								setEditingLabelForAddress
							}
							labelText={labelText}
							setLabelText={setLabelText}
							googlePlacesRef={googlePlacesRef}
						/>
					</View>

					{/* Date & Time Section */}
					<View style={styles.sectionContainer}>
						<Text style={styles.sectionTitle}>Date & Time</Text>

						{/* Date Toggle */}
						<View style={styles.inputContainer}>
							<Text style={styles.label}>Date</Text>
							<TouchableOpacity
								onPress={() => toggleDatePicker("date")}
								style={styles.dateButton}
							>
								<Text style={styles.dateButtonText}>
									{formatDate(date)}
								</Text>
								<Ionicons
									name="calendar-outline"
									size={22}
									color="#555"
								/>
							</TouchableOpacity>
							<DatePicker
								modal
								open={openDate}
								date={date}
								mode="date"
								onConfirm={(date) => {
									toggleDatePicker("date");
									setDate(date);
								}}
								onCancel={() => {
									toggleDatePicker("date");
								}}
							/>
						</View>

						<View style={styles.checkboxWrapper}>
							<TouchableOpacity
								onPress={toggleAllDay}
								style={styles.checkboxContainer}
							>
								<View style={styles.checkbox}>
									<Ionicons
										name={
											allDay
												? "checkbox"
												: "square-outline"
										}
										size={24}
										color="#3d7eea"
									/>
								</View>
								<Text style={styles.checkboxLabel}>
									All Day
								</Text>
							</TouchableOpacity>
						</View>

						{!allDay && (
							<View style={styles.timeContainer}>
								{/* Start Time Section */}
								<View
									style={[
										styles.inputContainer,
										styles.timeField,
									]}
								>
									<Text style={styles.label}>Start Time</Text>
									<TouchableOpacity
										onPress={() =>
											toggleDatePicker("startTime")
										}
										style={styles.dateButton}
									>
										<Text style={styles.dateButtonText}>
											{formatTime(startTime)}
										</Text>
										<Ionicons
											name="time-outline"
											size={22}
											color="#555"
										/>
									</TouchableOpacity>
									<DatePicker
										modal
										open={openStartTime}
										date={startTime}
										mode="time"
										onConfirm={(date) => {
											toggleDatePicker("startTime");
											setStartTime(date);
										}}
										onCancel={() => {
											toggleDatePicker("startTime");
										}}
									/>
								</View>

								{/* End Time Toggle */}
								<View style={styles.checkboxWrapper}>
									<TouchableOpacity
										onPress={toggleEndTime}
										style={styles.checkboxContainer}
									>
										<View style={styles.checkbox}>
											<Ionicons
												name={
													hasEndTime
														? "checkbox"
														: "square-outline"
												}
												size={24}
												color="#3d7eea"
											/>
										</View>
										<Text style={styles.checkboxLabel}>
											End Time
										</Text>
									</TouchableOpacity>
								</View>

								{hasEndTime && (
									<View
										style={[
											styles.inputContainer,
											styles.timeField,
										]}
									>
										<Text style={styles.label}>
											End Time
										</Text>
										<TouchableOpacity
											onPress={() =>
												toggleDatePicker("endTime")
											}
											style={styles.dateButton}
										>
											<Text style={styles.dateButtonText}>
												{formatTime(endTime, false)}
											</Text>
											<Ionicons
												name="time-outline"
												size={22}
												color="#555"
											/>
										</TouchableOpacity>
										<DatePicker
											modal
											open={openEndTime}
											date={endTime}
											mode="datetime"
											onConfirm={(date) => {
												toggleDatePicker("endTime");
												setEndTime(date);
											}}
											onCancel={() => {
												toggleDatePicker("endTime");
											}}
										/>
									</View>
								)}
							</View>
						)}
					</View>

					{/* Assigned Workers Section */}
					<View style={styles.sectionContainer}>
						<Text style={styles.sectionTitle}>People</Text>
						<View
							style={[
								styles.inputContainer,
								{ zIndex: 3000, elevation: 3 },
							]}
						>
							<Text style={styles.label}>Assigned Workers</Text>
							<DropDownPicker
								searchPlaceholder="Search workers"
								multiple={true}
								min={0}
								max={5}
								value={assignedWorkers}
								setValue={setAssignedWorkers}
								items={availableWorkers}
								setItems={setAvailableWorkers}
								open={openSelect}
								setOpen={() => toggleDatePicker("select")}
								mode="BADGE"
								listMode="SCROLLVIEW"
								searchable={true}
								maxHeight={200}
								style={styles.dropdown}
								dropDownContainerStyle={styles.dropdownList}
								listItemContainerStyle={styles.dropdownItem}
								badgeColors={["#3d7eea"]}
								badgeTextStyle={{ color: "white" }}
								zIndex={3000}
								placeholder="Select workers"
							/>
						</View>
					</View>

					{/* Notes Section */}
					<View style={[styles.sectionContainer, { zIndex: 1 }]}>
						<Text style={styles.sectionTitle}>
							Additional Information
						</Text>
						<View style={styles.inputContainer}>
							<Text style={styles.label}>Notes</Text>
							<TextInput
								style={styles.notesInput}
								placeholder="Add any additional notes about this event"
								placeholderTextColor="#A0A0A0"
								multiline={true}
								numberOfLines={4}
								value={notes}
								onChangeText={setNotes}
							/>
						</View>

						{/* Attachments Section */}
						<View style={styles.attachmentsContainer}>
							<Text style={styles.label}>Attachments</Text>
							<AttachmentsSelector
								showDocuments={true}
								showMedia={true}
								attachments={attachments}
								setAttachments={setAttachments}
								deletionQueue={attachmentDeletionQueue}
								setDeletionQueue={setAttachmentDeletionQueue}
								uploadProgress={uploadProgress}
							/>
						</View>
					</View>
				</View>

				{/* Action Buttons */}
				<View style={styles.actionButtonsContainer}>
					<Button
						title={isEditing ? "Update Event" : "Create Event"}
						onPress={() => {
							// Validate before submitting
							if (!title.trim()) {
								Alert.alert(
									"Error",
									"Please enter a title for the event",
								);
								return;
							}

							handleAttachmentSubmit();
						}}
						style={styles.submitButton}
						textStyle={styles.submitButtonText}
						variant="primary"
						fullWidth
						loading={isLoading || isUploading}
						disabled={
							(isEditing && !canSubmit()) ||
							isUploading ||
							isLoading
						}
						icon={<Ionicons name="send" size={22} color="white" />}
					/>

					{isEditing && (
						<Button
							title="Delete Event"
							onPress={handleDelete}
							style={styles.deleteButton}
							textStyle={styles.submitButtonText}
							variant="destructive"
							fullWidth
							icon={
								<Ionicons
									name="trash-outline"
									size={22}
									color="white"
								/>
							}
						/>
					)}
				</View>
			</KeyboardAwareScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	scrollContainer: {
		padding: 16,
		paddingBottom: 100,
	},
	formCard: {
		backgroundColor: "white",
		borderRadius: 12,
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 1 },
				shadowOpacity: 0.1,
				shadowRadius: 3,
			},
			android: {
				elevation: 2,
			},
		}),
		marginBottom: 16,
		overflow: "hidden",
	},
	sectionContainer: {
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#333",
		marginBottom: 16,
	},
	inputContainer: {
		marginBottom: 16,
	},
	timeContainer: {
		flexDirection: "column",
	},
	timeField: {
		flex: 1,
	},
	label: {
		fontSize: 15,
		marginBottom: 8,
		color: "#555",
		fontWeight: "500",
	},
	input: {
		height: 50,
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 15,
		fontSize: 16,
		backgroundColor: "white",
		color: "#333",
	},
	dateButton: {
		backgroundColor: "white",
		padding: 15,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#e0e0e0",
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	dateButtonText: {
		fontSize: 16,
		color: "#333",
	},
	checkboxWrapper: {
		marginBottom: 16,
	},
	checkboxContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	checkbox: {
		marginRight: 8,
	},
	checkboxLabel: {
		fontSize: 15,
		color: "#333",
		fontWeight: "500",
	},
	dropdown: {
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		backgroundColor: "white",
		minHeight: 50,
	},
	dropdownList: {
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		backgroundColor: "white",
		marginTop: 1,
		position: "relative",
		top: 0,
	},
	dropdownItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
		minHeight: 40,
		justifyContent: "center",
	},
	notesInput: {
		minHeight: 100,
		borderColor: "#e0e0e0",
		borderWidth: 1,
		borderRadius: 8,
		paddingHorizontal: 15,
		paddingTop: 12,
		paddingBottom: 12,
		fontSize: 16,
		backgroundColor: "white",
		color: "#333",
		textAlignVertical: "top",
	},
	attachmentsContainer: {
		marginTop: 8,
	},
	actionButtonsContainer: {
		marginTop: 8,
		marginBottom: 24,
	},
	submitButton: {
		backgroundColor: "#3d7eea",
		padding: 15,
		borderRadius: 8,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
		marginBottom: 12,
	},
	submitButtonText: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "600",
		marginLeft: 8,
	},
	deleteButton: {
		backgroundColor: "#e74c3c",
		padding: 15,
		borderRadius: 8,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
	},
});

export default EventSubmit;
