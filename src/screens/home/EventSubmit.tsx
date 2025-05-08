import "react-native-get-random-values";
import React, { useRef, useEffect } from "react";
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
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
import { useEventForm, Location } from "../../hooks/useEventForm";
import { EventFormHeader } from "../../components/eventSubmit/EventFormHeader";
import { LocationInput } from "../../components/eventSubmit/LocationInput";
import { AttachmentUploader } from "../../components/eventSubmit/AttachmentUploader";
import { useUser } from "../../contexts/UserContext";
import { Button } from "../../components/ui/Button";
import { Checkbox } from "../../components/ui/Checkbox";

// Types
type RootStackParamList = {
	EventDetails: {
		uid: string;
	};
};

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
		files,
		originalValues,

		// UI state
		openSelect,
		openDate,
		openStartTime,
		openEndTime,
		isLoading,
		isEditing,
		personal,
		availableWorkers,
		setAvailableWorkers,
		editingLabelForAddress,
		setEditingLabelForAddress,
		labelText,
		setLabelText,
		deletionQueue,

		// Methods
		updateLocation,
		deleteLocation,
		setLocationLabel,
		toggleDatePicker,
		toggleAllDay,
		toggleEndTime,
		addToUploadQueue,
		deleteFile,
		undoDeleteFile,
		handleSubmit,
		handleDelete,
		hasFormChanged,
	} = useEventForm(navigation, eventId);

	const { companyId: currentCompany } = useUser();

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

	const formatDate = (date: Date) =>
		moment(date).format("dddd, MMMM Do YYYY");
	const formatTime = (time: Date, start: boolean = true) => {
		if (start) {
			return moment(time).format("h:mm A");
		}
		return moment(time).format("ddd, MMM Do h:mm A");
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

				{/* Title Section */}
				<View style={styles.inputContainer}>
					<Text style={styles.label}>Title</Text>
					<TextInput
						style={styles.input}
						placeholder="Enter Title"
						value={title}
						onChangeText={setTitle}
					/>
				</View>

				{/* Location Section */}
				<LocationInput
					locations={locations}
					onLocationSelect={updateLocation}
					onLocationDelete={deleteLocation}
					onLabelChange={setLocationLabel}
					editingLabelForAddress={editingLabelForAddress}
					setEditingLabelForAddress={setEditingLabelForAddress}
					labelText={labelText}
					setLabelText={setLabelText}
					googlePlacesRef={googlePlacesRef}
				/>

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
						onCancel={() => toggleDatePicker("date")}
					/>
				</View>

				<View style={styles.inputContainer}>
					<TouchableOpacity
						onPress={toggleAllDay}
						style={styles.checkboxContainer}
					>
						<Ionicons
							name={allDay ? "checkbox" : "square-outline"}
							size={24}
							color="#555"
						/>
						<Text style={styles.checkboxLabel}>All Day</Text>
					</TouchableOpacity>
				</View>

				{!allDay && (
					<>
						{/* Start Time Section */}
						<View style={styles.inputContainer}>
							<Text style={styles.label}>Start Time</Text>
							<TouchableOpacity
								onPress={() => toggleDatePicker("startTime")}
								style={styles.dateButton}
							>
								<Text style={styles.dateButtonText}>
									{formatTime(startTime)}
								</Text>
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
								onCancel={() => toggleDatePicker("startTime")}
							/>
						</View>

						{/* End Time Toggle */}
						<View style={styles.inputContainer}>
							<TouchableOpacity
								onPress={toggleEndTime}
								style={styles.checkboxContainer}
							>
								<Ionicons
									name={
										hasEndTime
											? "checkbox"
											: "square-outline"
									}
									size={24}
									color="#555"
								/>
								<Text style={styles.checkboxLabel}>
									End Time (Optional)
								</Text>
							</TouchableOpacity>

							{hasEndTime && (
								<>
									<TouchableOpacity
										onPress={() =>
											toggleDatePicker("endTime")
										}
										style={[
											styles.dateButton,
											styles.marginTop,
										]}
									>
										<Text style={styles.dateButtonText}>
											{formatTime(endTime, false)}
										</Text>
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
										onCancel={() =>
											toggleDatePicker("endTime")
										}
									/>
								</>
							)}
						</View>
					</>
				)}

				{/* Assigned Workers Section */}
				<View
					style={[
						styles.inputContainer,
						{ zIndex: 3000, elevation: 3 },
					]}
				>
					<Text style={styles.label}>Assigned Workers</Text>
					<DropDownPicker
						searchPlaceholder="Search"
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
						dropDownContainerStyle={[
							styles.dropdownList,
							{ position: "relative", top: 0 },
						]}
						listItemContainerStyle={styles.dropdownItem}
						zIndex={3000}
						placeholder="Select"
					/>
				</View>

				{/* Notes Section */}
				<View style={[styles.inputContainer, { zIndex: 1 }]}>
					<Text style={styles.label}>Notes</Text>
					<TextInput
						style={[
							styles.input,
							{ height: 100, textAlignVertical: "top" },
						]}
						placeholder="Add any additional notes"
						multiline={true}
						numberOfLines={4}
						value={notes}
						onChangeText={setNotes}
					/>
				</View>

				{/* Attachments Section */}
				{!personal && (
					<AttachmentUploader
						files={files}
						onFilesAdded={addToUploadQueue}
						onFileDelete={deleteFile}
						onFileUndelete={undoDeleteFile}
						deletionQueue={deletionQueue}
					/>
				)}

				{/* Submission Button */}
				<Button
					title={isEditing ? "Update" : "Submit"}
					onPress={handleSubmit}
					style={styles.submitButton}
					textStyle={styles.submitButtonText}
					variant="primary"
					fullWidth
					loading={isLoading}
					disabled={isEditing && !hasFormChanged()}
					icon={<Ionicons name="send" size={24} color="white" />}
				/>

				{isEditing && (
					<Button
						title="Delete"
						onPress={handleDelete}
						style={styles.deleteButton}
						textStyle={styles.submitButtonText}
						variant="destructive"
						fullWidth
					/>
				)}
			</KeyboardAwareScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f5f5",
	},
	scrollContainer: {
		padding: 20,
		paddingBottom: 80,
	},
	inputContainer: {
		marginBottom: 20,
	},
	label: {
		fontSize: 16,
		marginBottom: 8,
		color: "#555",
		fontWeight: "600",
	},
	input: {
		height: 50,
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 15,
		fontSize: 16,
		backgroundColor: "white",
	},
	dateButton: {
		backgroundColor: "white",
		padding: 15,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#ccc",
	},
	dateButtonText: {
		fontSize: 16,
		color: "#333",
	},
	checkboxContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	checkboxLabel: {
		fontSize: 16,
		color: "#555",
		fontWeight: "600",
		marginLeft: 8,
		marginBottom: 0,
	},
	marginTop: {
		marginTop: 10,
	},
	dropdown: {
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		backgroundColor: "white",
		minHeight: 50,
	},
	dropdownList: {
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		backgroundColor: "white",
		marginTop: 1,
	},
	dropdownItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		minHeight: 40,
		justifyContent: "center",
	},
	submitButton: {
		backgroundColor: "#555",
		padding: 15,
		borderRadius: 10,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
		zIndex: 100,
		elevation: 3,
		marginTop: 20,
		marginBottom: 20,
	},
	submitButtonText: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "bold",
		marginRight: 10,
	},
	deleteButton: {
		backgroundColor: "red",
		padding: 15,
		borderRadius: 10,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
		zIndex: 100,
		elevation: 3,
		marginTop: 20,
		marginBottom: 20,
	},
});

export default EventSubmit;
