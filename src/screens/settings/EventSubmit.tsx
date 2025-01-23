import "react-native-get-random-values";
import { GOOGLE_PLACES_API_KEY } from "@env";
import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	Alert,
	ScrollView,
	Platform,
	KeyboardAvoidingView,
	ActivityIndicator,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import {
	GooglePlacesAutocomplete,
	GooglePlacesAutocompleteRef,
} from "react-native-google-places-autocomplete";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import { capitalize } from "lodash";
import moment from "moment";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import DocumentPicker from "react-native-document-picker";
import * as ImagePicker from "react-native-image-picker";
import { Event, addEvent } from "../../controllers/eventController";
import {
	subscribeCurrentUser,
	getUser,
	User,
} from "../../controllers/userController";
import { subscribeAllUsersInCompany } from "../../controllers/companyController";
import storage from "@react-native-firebase/storage";

export interface UploadedFile {
	filename: string;
	url: string;
	type: string;
	uploadTime: number;
	path: string;
}

const EventSubmit = ({ navigation }) => {
	const [title, setTitle] = useState("");
	const [date, setDate] = useState(new Date());
	const [startTime, setStartTime] = useState(new Date());
	const [hasEndTime, setHasEndTime] = useState(false);
	const [endTime, setEndTime] = useState(new Date());
	const [locations, setLocations] = useState<Location>({});
	const [assignedWorkers, setAssignedWorkers] = useState([]);
	const [openSelect, setOpenSelect] = useState(false);
	const [openDate, setOpenDate] = useState(false);
	const [openStartTime, setOpenStartTime] = useState(false);
	const [openEndTime, setOpenEndTime] = useState(false);
	const [availableWorkers, setAvailableWorkers] = useState([]);
	const [isLoading, setIsLoading] = useState(false);
	const [currentCompany, setCurrentCompany] = useState<string>("");
	const [notes, setNotes] = useState("");
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [eventId] = useState(`temp_${Date.now()}`);

	type Location = {
		[address: string]: {
			latitude: number;
			longitude: number;
			label: string;
		};
	};

	const googlePlacesRef = useRef<GooglePlacesAutocompleteRef | null>(null);

	useEffect(() => {
		const subscriber = subscribeCurrentUser((snapshot) => {
			if (snapshot.exists) {
				const userData = snapshot.data() as User;
				setCurrentCompany(userData.loggedInCompany);
			}
		});
		return () => subscriber();
	}, []);

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
					})
				);
				setAvailableWorkers(workers);
			}
		);
		return () => subscriber();
	}, [currentCompany]);

	const validateFields = () => {
		if (!title.trim()) {
			Alert.alert("Title is required.");
			return false;
		}
		// if (Object.keys(locations).length === 0) {
		// 	Alert.alert("At least one location is required.");
		// 	return false;
		// }
		if (hasEndTime && endTime <= startTime) {
			Alert.alert("End time must be after start time.");
			return false;
		}
		return true;
	};

	const calculateDuration = () => {
		if (!hasEndTime) return null;
		const hours = moment(endTime).diff(startTime, "minutes") / 60;
		return Number.isInteger(hours) ? hours.toFixed(1) : hours.toString();
	};

	const updateLocation = (details: any) => {
		const address = details.formatted_address;
		const coords = details.geometry.location;

		const newLocations = {
			...locations,
			[address]: {
				latitude: coords.lat,
				longitude: coords.lng,
			},
		};

		setLocations(newLocations);
	};

	const uploadToFirebase = async (
		uri: string,
		filename: string,
		type: string
	): Promise<string> => {
		try {
			const fileCategory = type.startsWith("image/")
				? "images"
				: "documents";
			const storagePath = `companies/${currentCompany}/events/${eventId}/${fileCategory}/${filename}`;
			const storageRef = storage().ref(storagePath);

			const uploadUri =
				Platform.OS === "ios" ? uri.replace("file://", "") : uri;

			const task = storageRef.putFile(uploadUri);
			task.on("state_changed", (snapshot) => {
				const progress =
					(snapshot.bytesTransferred / snapshot.totalBytes) * 100;
				console.log(`Upload is ${progress}% complete`);
			});

			await task;
			const url = await storageRef.getDownloadURL();
			return url;
		} catch (error) {
			console.error("Upload error:", error);
			throw error;
		}
	};

	const handleDocumentUpload = async () => {
		try {
			const results = await DocumentPicker.pick({
				type: [DocumentPicker.types.images, DocumentPicker.types.pdf],
				allowMultiSelection: true,
			});

			const uploadPromises = results.map(async (file) => {
				const url = await uploadToFirebase(
					file.uri,
					file.name,
					file.type
				);

				return {
					filename: file.name,
					url: url,
					type: file.type,
					path: `companies/${currentCompany}/events/${eventId}/${
						file.type.startsWith("image/") ? "images" : "documents"
					}/${file.name}`,
					uploadTime: Date.now(),
				};
			});

			const uploadedDocs = await Promise.all(uploadPromises);
			setUploadedFiles((prev) => [...prev, ...uploadedDocs]);
		} catch (err) {
			if (!DocumentPicker.isCancel(err)) {
				console.error(err);
				Alert.alert("Upload Error", "Failed to upload document");
			}
		}
	};

	const handleImageUpload = async () => {
		const options: ImagePicker.ImageLibraryOptions = {
			mediaType: "photo",
			quality: 0.8,
			selectionLimit: 0,
		};

		try {
			const response = await ImagePicker.launchImageLibrary(options);

			if (response.assets) {
				const uploadPromises = response.assets.map(async (asset) => {
					if (!asset.uri || !asset.fileName) return null;

					const url = await uploadToFirebase(
						asset.uri,
						asset.fileName,
						asset.type || "image/jpeg"
					);

					return {
						filename: asset.fileName,
						url: url,
						type: asset.type || "image/jpeg",
						path: `companies/${currentCompany}/events/${eventId}/images/${asset.fileName}`,
						uploadTime: Date.now(),
					};
				});
				const uploadedImages = (
					await Promise.all(uploadPromises)
				).filter(Boolean) as UploadedFile[];
				setUploadedFiles((prev) => [...prev, ...uploadedImages]);
			}
		} catch (err) {
			console.error(err);
			Alert.alert("Upload Error", "Failed to upload image");
		}
	};

	const cleanupTempFiles = async () => {
		try {
			for (const file of uploadedFiles) {
				const ref = storage().ref(file.path);
				await ref.delete();
			}
		} catch (error) {
			console.error("Cleanup error: ", error);
		}
	};

	const handleEventSubmission = async () => {
		console.log("Submitting event...");
		if (!validateFields()) {
			return;
		}

		const validatedLocations = validateLocations(locations);
		try {
			setIsLoading(true);
			const eventData: Event = {
				title: capitalize(title),
				date: moment(date).format("YYYY-MM-DD"),
				startTime: moment(startTime).format("HH:mm"),
				endTime: hasEndTime ? moment(endTime).format("HH:mm") : null,
				locations:
					Object.keys(validatedLocations).length > 0
						? validatedLocations
						: null,
				duration: calculateDuration(),
				notes: notes,
				assignedWorkers: assignedWorkers,
				attachments: uploadedFiles,
			};

			await addEvent(currentCompany, eventData);
			console.log("Event successfully created!");
			navigation.pop();
		} catch (error) {
			await cleanupTempFiles();
			switch (error.code) {
				case "event/invalid-workers":
					Alert.alert(
						"One or more selected workers are not available!"
					);
					break;
				default:
					Alert.alert("Error creating event, please try again");
					console.error(error);
			}
		} finally {
			setIsLoading(false);
		}
	};

	const renderUploadedFiles = () => (
		<View style={styles.uploadedFilesContainer}>
			{uploadedFiles.map((file, index) => (
				<View key={index} style={styles.uploadedFileItem}>
					<Text numberOfLines={1} style={styles.filename}>
						{file.filename}
					</Text>
					<TouchableOpacity
						onPress={() => {
							setUploadedFiles((prev) =>
								prev.filter((_, i) => i !== index)
							);
						}}
						style={styles.removeButton}
					>
						<Ionicons name="close-circle" size={24} color="red" />
					</TouchableOpacity>
				</View>
			))}
		</View>
	);

	const validateLocations = (locations: Location) => {
		return Object.entries(locations).reduce(
			(acc: Location, [key, value]) => {
				// Check if location has valid coordinates
				if (value.latitude && value.longitude) {
					acc[key] = value;
				}
				return acc;
			},
			{}
		);
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
					{/* Header */}
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
					<View style={styles.inputContainer}>
						<Text style={styles.label}>Location(s)</Text>
						<View style={styles.locationContainer}>
							<GooglePlacesAutocomplete
								ref={googlePlacesRef}
								placeholder="Search for a location"
								onPress={(data, details = null) => {
									if (details) {
										updateLocation(details);
									}
									googlePlacesRef.current?.clear();
								}}
								query={{
									key: GOOGLE_PLACES_API_KEY,
									language: "en",
								}}
								styles={{
									textInput: styles.placesTextInput,
									listView: styles.placesListView,
									row: styles.placesRow,
								}}
								fetchDetails={true}
							/>
						</View>
						{Object.keys(locations).map((address) => (
							<>
								<View style={{ marginBottom: 10 }}>
									<View
										key={address}
										style={styles.locationContainer}
									>
										<Text
											style={[styles.label, { flex: 1 }]}
										>
											{address}
										</Text>
										<TouchableOpacity
											onPress={() => {
												Alert.prompt(
													"Add Label",
													"Enter a label for this location",
													[
														{
															text: "Cancel",
															style: "cancel",
														},
														{
															text: "OK",
															onPress: (
																label
															) => {
																if (!label)
																	return;
																const newLocations =
																	{
																		...locations,
																	};
																newLocations[
																	address
																] = {
																	...newLocations[
																		address
																	],
																	label: label,
																};
																setLocations(
																	newLocations
																);
															},
														},
													]
												);
											}}
											style={styles.addLocationButton}
										>
											<Ionicons
												name="pencil-outline"
												size={24}
												color="#555"
											/>
										</TouchableOpacity>
										<TouchableOpacity
											onPress={() => {
												const newLocations = {
													...locations,
												};
												delete newLocations[address];
												setLocations(newLocations);
											}}
											style={styles.deleteButton}
										>
											<Ionicons
												name="trash-outline"
												size={24}
												color="red"
											/>
										</TouchableOpacity>
									</View>
									<View
										key={address}
										style={{ marginTop: -5 }}
									>
										{locations[address].label && (
											<Text
												style={[
													styles.label,
													{ flex: 1, fontSize: 14 },
												]}
											>
												"{locations[address].label}"
											</Text>
										)}
									</View>
								</View>
							</>
						))}
					</View>

					{/* Date Toggle */}
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

					{/* Start Time Section */}
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

					{/* End Time Toggle */}
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
							setOpen={checkSelectOpen}
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
							onChange={(text) => setNotes(text.nativeEvent.text)}
						/>
					</View>

					{/* Attachments Section */}
					{renderAttachmentsSection()}

					{/* Submission Button */}
					<TouchableOpacity
						style={[styles.submitButton, { zIndex: 1 }]}
						onPress={handleEventSubmission}
					>
						<Text style={styles.submitButtonText}>Submit</Text>
						<Ionicons name="send" size={24} color="white" />
					</TouchableOpacity>
					{isLoading && (
						<ActivityIndicator size="small" color="#0000ff" />
					)}
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
	locationContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
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
	addLocationButton: {
		padding: 5,
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
	locationInput: {
		flex: 1,
		marginRight: 10,
	},
	deleteButton: {
		padding: 5,
	},
	uploadedFilesContainer: {
		marginTop: 10,
	},
	uploadedFileItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f5f5f5",
		padding: 8,
		borderRadius: 8,
		marginBottom: 5,
	},
	filename: {
		flex: 1,
		marginRight: 10,
	},
	removeButton: {
		padding: 5,
	},
});

export default EventSubmit;
