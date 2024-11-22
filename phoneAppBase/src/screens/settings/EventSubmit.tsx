import React, { useState } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	ScrollView,
	Platform,
	KeyboardAvoidingView,
} from "react-native";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";

/*
  STILL NEED TO DO:
  - Add optional end time for events
  - time conversions?
*/

const EventSubmit = () => {
	const [title, setTitle] = useState("");
	const [date, setDate] = useState(new Date());
	const [startTime, setStartTime] = useState(
		new Date(new Date().setHours(0, 0, 0, 0))
	);
	const [endTime, setEndTime] = useState(
		new Date(new Date().setHours(23, 59, 59, 0))
	);
	const [worker, setWorker] = useState([]);
	const [notes, setNotes] = useState("");
	const [openSelect, setOpenSelect] = useState(false);
	const [openDate, setOpenDate] = useState(false);
	const [openStartTime, setOpenStartTime] = useState(false);
	const [openEndTime, setOpenEndTime] = useState(false);
	const [items, setItems] = useState([
		{ label: "Devin", value: "devin" },
		{ label: "Bakos", value: "bakos" },
		{ label: "Billy", value: "billy" },
	]);

	const handleSubmit = () => {
		console.log("Form submitted");
	};

	const formatDate = (date: Date) => {
		return moment(date).format("dddd, MMMM Do YYYY");
	};

	const formatTime = (time: Date) => {
		return moment(time).format("h:mm A");
	};

	const checkDateOpen = () => {
		setOpenDate(!openDate);
		if (openSelect) {
			setOpenSelect(false);
		}
	};

	const checkStartTimeOpen = () => {
		setOpenStartTime(!openStartTime);
		if (openSelect) {
			setOpenSelect(false);
		}
	};

	const checkEndTimeOpen = () => {
		setOpenEndTime(!openEndTime);
		if (openSelect) {
			setOpenSelect(false);
		}
	};

	const checkSelectOpen = () => {
		setOpenSelect(!openSelect);
		if (openDate) {
			setOpenDate(false);
		}
		if (openStartTime) {
			setOpenStartTime(false);
		}

		if (openEndTime) {
			setOpenEndTime(false);
		}
	};

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={styles.container}
		>
			<SafeAreaView>
				<ScrollView contentContainerStyle={styles.scrollContainer}>
					<Text style={styles.heading}>Submit New Event</Text>

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
							onCancel={() => {}}
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
							onCancel={() => {}}
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
							onConfirm={(date) => {
								setOpenDate(false);
								setDate(date);
							}}
							onCancel={() => {
								setOpenDate(false);
							}}
						/>
					</View>

					<View style={styles.inputContainer}>
						<Text style={styles.label}>End Time</Text>
						<TouchableOpacity
							onPress={checkEndTimeOpen}
							style={styles.dateButton}
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
							onCancel={() => {}}
						/>
					</View>

					<View style={styles.inputContainer}>
						<Text style={styles.label}>Assigned Worker</Text>
						<DropDownPicker
							multiple={true}
							min={0}
							max={5}
							value={worker}
							setValue={setWorker}
							items={items}
							open={openSelect}
							setOpen={checkSelectOpen}
							mode={"BADGE"}
							listMode="SCROLLVIEW"
							searchable={true}
						/>
					</View>

					<View style={styles.inputContainer}>
						<Text style={styles.label}>Notes</Text>
						<TextInput
							style={[styles.input, styles.notesInput]}
							placeholder="Enter notes"
							value={notes}
							onChangeText={setNotes}
							multiline={true}
							textAlignVertical="top"
						/>
					</View>

					<TouchableOpacity
						style={styles.submitButton}
						onPress={handleSubmit}
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
	heading: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 20,
		color: "#333",
		textAlign: "center",
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
	notesInput: {
		height: 120,
		textAlignVertical: "top",
		paddingTop: 15,
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
	submitButton: {
		backgroundColor: "#007AFF",
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
});

export default EventSubmit;
