import { GOOGLE_PLACES_API_KEY } from "@env";
import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	ScrollView,
	Platform,
	KeyboardAvoidingView,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import DocumentPicker from "react-native-document-picker";
import * as ImagePicker from "react-native-image-picker";

/*
  TODO:
  - full event submission backend
  - populate workers from company's users
  - image/document storage in firebase
  - verify required sections are filled out before submitting
  - time conversions?
*/

const EventSubmit = ({ navigation }) => {
	const [title, setTitle] = useState("");
	const [date, setDate] = useState(new Date());
	const [startTime, setStartTime] = useState(new Date());
	const [hasEndTime, setHasEndTime] = useState(false);
	const [endTime, setEndTime] = useState(new Date());
	const [location, setLocation] = useState("");
	const [worker, setWorker] = useState([]);
	const [openSelect, setOpenSelect] = useState(false);
	const [openDate, setOpenDate] = useState(false);
	const [openStartTime, setOpenStartTime] = useState(false);
	const [openEndTime, setOpenEndTime] = useState(false);
	const [workers, setWorkers] = useState([
		{ label: "Devin", value: "devin" },
		{ label: "Bakos", value: "bakos" },
		{ label: "Billy", value: "billy" },
	]);

	const handleDocumentUpload = async () => {
		try {
			const results = await DocumentPicker.pick({
				type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
				allowMultiSelection: true,
			});
		} catch (err) {
			if (!DocumentPicker.isCancel(err)) {
				console.error(err);
			}
		}
	};

	const handleImageUpload = async () => {
		const options: ImagePicker.ImageLibraryOptions = {
			mediaType: "photo",
			quality: 0.8 as ImagePicker.PhotoQuality,
			selectionLimit: 0,
		};

		try {
			const response = await ImagePicker.launchImageLibrary(options);
		} catch (err) {
			console.error(err);
		}
	};

	const formatDate = (date: moment.MomentInput) =>
		moment(date).format("dddd, MMMM Do YYYY");

	const formatTime = (time: moment.MomentInput) =>
		moment(time).format("h:mm A");

	const checkDateOpen = () => {
		setOpenDate(!openDate);
		if (openSelect) setOpenSelect(false);
	};

	const checkStartTimeOpen = () => {
		setOpenStartTime(!openStartTime);
		if (openSelect) setOpenSelect(false);
	};

	const checkEndTimeOpen = () => {
		setOpenEndTime(!openEndTime);
		if (openSelect) setOpenSelect(false);
	};

	const checkSelectOpen = () => {
		setOpenSelect(!openSelect);
		if (openDate) setOpenDate(false);
		if (openStartTime) setOpenStartTime(false);
		if (openEndTime) setOpenEndTime(false);
	};

	const handleEndTimeToggle = () => {
		const newHasEndTime = !hasEndTime;
		setHasEndTime(newHasEndTime);
		if (newHasEndTime) {
			setOpenEndTime(true);
		}
	};

	const renderAttachmentsSection = () => (
		<View style={[styles.inputContainer, { zIndex: 1 }]}>
			<Text style={styles.label}>Attachments</Text>
			<View style={styles.uploadButtonsContainer}>
				<TouchableOpacity
					style={styles.uploadButton}
					onPress={handleDocumentUpload}
				>
					<Ionicons name="document-outline" size={24} color="#555" />
					<Text style={styles.uploadButtonText}>Upload Files</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.uploadButton}
					onPress={handleImageUpload}
				>
					<Ionicons name="image-outline" size={24} color="#555" />
					<Text style={styles.uploadButtonText}>Choose Images</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={styles.container}
		>
			<SafeAreaView style={{ flex: 1 }}>
				<ScrollView
					contentContainerStyle={styles.scrollContainer}
					nestedScrollEnabled={true}
				>
					<View style={styles.header}>
						<TouchableOpacity
							containerStyle={{
								position: "absolute",
								left: 20,
								zIndex: 1,
							}}
							onPress={() => {
								navigation.goBack();
							}}
						>
							<Ionicons
								name="chevron-back"
								size={28}
								color="#000"
							/>
						</TouchableOpacity>
						<Text style={styles.headerTitle}>Submit New Event</Text>
					</View>

					<View style={styles.inputContainer}>
						<Text style={styles.label}>Title</Text>
						<TextInput
							style={styles.input}
							placeholder="Enter Title"
							value={title}
							onChangeText={setTitle}
						/>
					</View>

					<View style={styles.inputContainer}>
						<Text style={styles.label}>Location</Text>
						<GooglePlacesAutocomplete
							placeholder="Search for address"
							onPress={(data) => {
								setLocation(data.description);
							}}
							query={{
								key: GOOGLE_PLACES_API_KEY,
								language: "en",
							}}
							styles={{
								container: styles.placesContainer,
								textInput: styles.placesTextInput,
								listView: styles.placesListView,
								row: styles.placesRow,
							}}
						/>
					</View>

					<View style={styles.inputContainer}>
						<Text style={styles.label}>Date</Text>
						<TouchableOpacity
							onPress={checkDateOpen}
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
								setOpenDate(false);
								setDate(date);
							}}
							onCancel={() => setOpenDate(false)}
						/>
					</View>

					<View style={styles.inputContainer}>
						<Text style={styles.label}>Start Time</Text>
						<TouchableOpacity
							onPress={checkStartTimeOpen}
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
								setOpenStartTime(false);
								setStartTime(date);
							}}
							onCancel={() => setOpenStartTime(false)}
						/>
					</View>

					<View style={styles.inputContainer}>
						<TouchableOpacity
							onPress={handleEndTimeToggle}
							style={styles.checkboxContainer}
						>
							<Ionicons
								name={
									hasEndTime ? "checkbox" : "square-outline"
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
									onPress={checkEndTimeOpen}
									style={[
										styles.dateButton,
										styles.marginTop,
									]}
								>
									<Text style={styles.dateButtonText}>
										{formatTime(endTime)}
									</Text>
								</TouchableOpacity>
								<DatePicker
									modal
									open={openEndTime}
									date={endTime}
									mode="time"
									onConfirm={(date) => {
										setOpenEndTime(false);
										setEndTime(date);
									}}
									onCancel={() => {
										setOpenEndTime(false);
										if (!endTime) {
											setHasEndTime(false);
										}
									}}
								/>
							</>
						)}
					</View>

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
							value={worker}
							setValue={setWorker}
							items={workers}
							setItems={setWorkers}
							open={openSelect}
							setOpen={checkSelectOpen}
							mode="BADGE"
							listMode="SCROLLVIEW"
							searchable={true}
							maxHeight={200}
							style={styles.dropdown}
							dropDownContainerStyle={[
								styles.dropdownList,
								{
									position: "relative",
									top: 0,
								},
							]}
							listItemContainerStyle={styles.dropdownItem}
							zIndex={3000}
							placeholder="Select"
						/>
					</View>

					{renderAttachmentsSection()}

					<TouchableOpacity
						style={[styles.submitButton, { zIndex: 1 }]}
						onPress={() => console.log("Form submitted")}
					>
						<Text style={styles.submitButtonText}>Submit</Text>
						<Ionicons name="send" size={24} color="white" />
					</TouchableOpacity>
				</ScrollView>
			</SafeAreaView>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f5f5",
	},
	scrollContainer: {
		padding: 20,
		paddingBottom: 40,
	},
	header: {
		display: "flex",
		marginBottom: 20,
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333",
		textAlign: "center",
	},
	inputContainer: {
		marginBottom: 20,
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
	marginTop: {
		marginTop: 10,
	},
	submitButton: {
		backgroundColor: "#555",
		padding: 15,
		borderRadius: 10,
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
	},
	submitButtonText: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "bold",
		marginRight: 10,
	},
	placesContainer: {
		flex: 0,
	},
	placesTextInput: {
		height: 50,
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 15,
		fontSize: 16,
		backgroundColor: "white",
	},
	placesListView: {
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 10,
		backgroundColor: "white",
		marginTop: 5,
	},
	placesRow: {
		padding: 13,
		height: 44,
	},
	uploadButtonsContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 15,
	},
	uploadButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fff",
		padding: 12,
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "#555",
		flex: 0.48,
		justifyContent: "center",
	},
	uploadButtonText: {
		color: "#555",
		fontSize: 16,
		marginLeft: 8,
	},
	dropdownWrapper: {
		zIndex: 2000,
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
});

export default EventSubmit;
