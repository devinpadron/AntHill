import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Dimensions,
	ImageBackground,
	Linking,
	Platform,
} from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { subscribeCurrentUser } from "../../../controllers/userController";
import {
	subscribeEvent,
	updateEvent,
} from "../../../controllers/eventController";
import LoadingScreen from "../../LoadingScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import MapView, { Marker } from "react-native-maps";
import { getUser } from "../../../controllers/userController";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { subscribeEventAttachments } from "../../../controllers/attachmentController";
import ImageView from "react-native-image-viewing";
import { FileUpload } from "./EventSubmit";

type RootStackParamList = {
	EventDetails: {
		uid: string;
	};
};

type EventDetailsRouteProp = RouteProp<RootStackParamList, "EventDetails">;

const EventDetails = ({ navigation }) => {
	const route = useRoute<EventDetailsRouteProp>();
	if (!route.params) return null;
	console.log(route.params.uid);
	const [user, setUser] = useState(null);
	const [event, setEvent] = useState(null);
	const [markers, setMarkers] = useState([]);
	const [workerList, setWorkerList] = useState("");
	const [localNotes, setLocalNotes] = useState("");
	const [initialRegion, setInitialRegion] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [attachments, setAttachments] = useState([]);
	const [visible, setIsVisible] = useState(false);

	useEffect(() => {
		const subscriber = subscribeCurrentUser((user) => {
			setUser(user.data());
		});
		return () => subscriber();
	}, []);

	useEffect(() => {
		if (!user) return;
		const subscriber = subscribeEvent(
			user.loggedInCompany,
			route.params.uid,
			(event) => {
				setEvent(event.data());
			}
		);
		return () => subscriber();
	}, [user]);

	useEffect(() => {
		if (!event) return;
		const subscriber = subscribeEventAttachments(
			user.loggedInCompany,
			route.params.uid,
			(attachments) => {
				const files = attachments.docs.map(
					(doc) => doc.data() as FileUpload
				);
				setAttachments(files);
			}
		);
		return () => subscriber();
	}, [event]);

	useEffect(() => {
		if (!event) return;
		setIsLoading(true);
		const getLocationList = () => {
			setMarkers([]);
			const locations = event.locations;
			if (!locations) return;
			for (let location in locations) {
				setMarkers((prev) => [
					...prev,
					{
						latitude: locations[location].latitude,
						longitude: locations[location].longitude,
						title: location,
						label: locations[location].label,
					},
				]);
			}
		};
		getLocationList();

		setLocalNotes(event.userNotes || "");

		const getWorkerList = async () => {
			setWorkerList("");
			const assignedWorkers = event.assignedWorkers;
			let workerList = "";
			for (let i = 0; i < assignedWorkers.length; i++) {
				const workerData = await getUser(assignedWorkers[i]);
				workerList += workerData.firstName + " " + workerData.lastName;
				if (i < assignedWorkers.length - 1) workerList += ", ";
				setWorkerList(workerList);
			}
			setIsLoading(false);
		};
		getWorkerList();
	}, [event]);

	useEffect(() => {
		if (markers.length > 0) {
			setInitialRegion(getRegionForMarkers(markers));
		}
	}, [markers]);

	const getRegionForMarkers = (markers) => {
		if (!markers || markers.length === 0) return null;
		if (markers.length === 1) {
			return {
				latitude: markers[0].latitude,
				longitude: markers[0].longitude,
				latitudeDelta: 0.01 * 1.5,
				longitudeDelta: 0.01 * 1.5,
			};
		}

		// Initialize with first marker
		let minLat = markers[0].latitude;
		let maxLat = markers[0].latitude;
		let minLng = markers[0].longitude;
		let maxLng = markers[0].longitude;

		// Find min/max values
		markers.forEach((marker) => {
			minLat = Math.min(minLat, marker.latitude);
			maxLat = Math.max(maxLat, marker.latitude);
			minLng = Math.min(minLng, marker.longitude);
			maxLng = Math.max(maxLng, marker.longitude);
		});

		// Calculate center and deltas
		const centerLat = (minLat + maxLat) / 2;
		const centerLng = (minLng + maxLng) / 2;
		const latDelta = (maxLat - minLat) * 1.5; // 1.5 adds 50% padding
		const lngDelta = (maxLng - minLng) * 1.5;

		return {
			latitude: centerLat,
			longitude: centerLng,
			latitudeDelta: latDelta,
			longitudeDelta: lngDelta,
		};
	};

	const scrollViewRef = useRef(null);
	const markerRef = useRef(null);

	const openMap = ({ latitude, longitude, label }) => {
		const scheme = Platform.select({
			ios: `maps://?q=${label}&ll=${latitude},${longitude}`,
			android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
		});

		if (scheme) {
			Linking.openURL(scheme).catch((err) =>
				console.error("Error opening map: ", err)
			);
		}
	};

	const renderThumbnails = () => {
		const imageFiles = attachments.filter((file) =>
			file.type.startsWith("image/")
		);
		const images = imageFiles.map((file) => ({
			uri: file.url,
		}));
		const documentFiles = attachments.filter(
			(file) => !file.type.startsWith("image/")
		);

		return (
			<View style={styles.filesContainer}>
				{/* Image Grid */}
				{imageFiles.length > 0 && (
					<>
						<ImageView
							images={images}
							imageIndex={0}
							visible={visible}
							onRequestClose={() => setIsVisible(false)}
						/>
						<View style={styles.imageGrid}>
							{imageFiles.map((file, index) => (
								<View
									key={index}
									style={styles.thumbnailContainer}
								>
									<TouchableOpacity
										onPress={() => setIsVisible(true)}
									>
										<ImageBackground
											style={styles.thumbnail}
											source={{ uri: file.url }}
										/>
									</TouchableOpacity>
								</View>
							))}
						</View>
					</>
				)}

				{/* Document List */}
				{documentFiles.length > 0 && (
					<View style={styles.documentList}>
						{documentFiles.map((file, index) => (
							<>
								<TouchableOpacity
									onPress={() => Linking.openURL(file.url)}
								>
									<View
										key={index}
										style={styles.documentItem}
									>
										<Ionicons
											name="document-outline"
											size={24}
											color="#555"
											style={styles.documentIcon}
										/>
										<Text
											numberOfLines={1}
											style={styles.documentFilename}
										>
											{file.name}
										</Text>
									</View>
								</TouchableOpacity>
							</>
						))}
					</View>
				)}
			</View>
		);
	};

	if (isLoading || !event) return <LoadingScreen />;

	return (
		<SafeAreaView style={styles.container}>
			<KeyboardAwareScrollView
				ref={scrollViewRef}
				contentContainerStyle={{ flexGrow: 1 }}
				extraScrollHeight={100}
			>
				<View style={styles.header}>
					<TouchableOpacity
						containerStyle={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						<Ionicons name="chevron-back" size={28} color="#000" />
					</TouchableOpacity>
					<Text style={styles.title}>{event.title}</Text>
					{(user.companies[user.loggedInCompany] === "Owner" ||
						user.companies[user.loggedInCompany] === "Admin") && (
						<TouchableOpacity
							containerStyle={styles.editButton}
							onPress={() => {
								navigation.navigate("EditEvent", {
									uid: route.params.uid,
								});
							}}
						>
							<Ionicons
								name="create-outline"
								size={28}
								color="#000"
							/>
						</TouchableOpacity>
					)}
				</View>

				<View style={styles.content}>
					<View style={[styles.timeSection, { marginBottom: 10 }]}>
						<Text style={styles.timeText}>
							{moment(event.date).format("dddd, MMMM D, YYYY")}
						</Text>
					</View>

					<View style={styles.timeSection}>
						{event.startTime ? (
							<>
								<Text style={styles.timeText}>
									{moment(event.startTime, "HH:mm").format(
										"h:mma"
									)}
								</Text>

								{event.endTime && (
									<>
										<Text style={styles.timeText}>-</Text>
										<Text style={styles.timeText}>
											{moment(
												event.endTime,
												"HH:mm"
											).format("h:mma")}
										</Text>
									</>
								)}
							</>
						) : (
							<Text style={styles.timeText}>All Day</Text>
						)}
					</View>

					<View style={styles.duration}>
						{event.duration && (
							<Text style={{ fontSize: 18 }}>
								{event.duration} hours
							</Text>
						)}
					</View>

					<View style={styles.detailsSection}>
						{event.assignedWorkers && (
							<>
								<Text style={styles.label}>
									Assigned Workers
								</Text>
								<Text style={styles.text}>{workerList}</Text>
							</>
						)}
						{event.notes && (
							<>
								<Text style={styles.label}>Notes</Text>
								<Text style={styles.text}>{event.notes}</Text>
							</>
						)}
						{event.locations && (
							<MapView
								style={{ height: 300, marginBottom: 16 }}
								region={initialRegion}
							>
								{markers.map((marker, index) => (
									<Marker
										key={index}
										ref={markerRef}
										coordinate={{
											latitude: marker.latitude,
											longitude: marker.longitude,
										}}
										description={
											marker.label ? marker.title : ""
										}
										title={
											marker.label
												? marker.label
												: marker.title
										}
										onCalloutPress={() => openMap(marker)}
									/>
								))}
							</MapView>
						)}
					</View>

					{renderThumbnails()}

					<Text style={[styles.label, { marginTop: 10 }]}>
						Your Notes
					</Text>
					<TextInput
						style={[
							styles.text,
							{
								padding: 8,
								minHeight: 150,
							},
						]}
						multiline
						editable
						numberOfLines={5}
						value={localNotes}
						onChangeText={setLocalNotes}
						onBlur={() => {
							if (localNotes !== event.userNotes) {
								const updatedEvent = {
									...event,
									userNotes: localNotes,
								};
								updateEvent(
									user.loggedInCompany,
									route.params.uid,
									updatedEvent
								);
								setEvent(updatedEvent);
							}
						}}
						placeholder="Add your personal notes here..."
					/>
				</View>
			</KeyboardAwareScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	header: {
		display: "flex",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		justifyContent: "center",
	},
	backButton: {
		left: 20,
		position: "absolute",
		zIndex: 1,
	},
	editButton: {
		right: 20,
		position: "absolute",
		zIndex: 1,
	},
	title: {
		flex: 1,
		fontSize: 20,
		fontWeight: "bold",
		textAlign: "center",
	},
	content: {
		flex: 1,
		padding: 16,
	},
	duration: {
		marginBottom: 16,
		flexDirection: "row",
		justifyContent: "center",
	},
	timeSection: {
		flexDirection: "row",
		justifyContent: "center",
	},
	timeLabel: {
		fontSize: 14,
		color: "#666",
		marginBottom: 4,
	},
	timeText: {
		fontSize: 20,
		fontWeight: "500",
		paddingHorizontal: 4,
	},
	detailsSection: {
		gap: 12,
	},
	label: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
	},
	text: {
		fontSize: 16,
		lineHeight: 20,
		marginBottom: 12,
	},
	thumbnailContainer: {
		width: "30%", // 3 columns with padding
		aspectRatio: 1,
		borderRadius: 8,
		backgroundColor: "#f5f5f5",
		position: "relative",
		overflow: "visible",
	},
	thumbnail: {
		width: (Dimensions.get("window").width - 60) / 3,
		height: "100%",
		borderRadius: 8,
		zIndex: 1,
	},
	filesContainer: {
		marginTop: 16,
	},
	imageGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginBottom: 10,
		paddingBottom: 20,
	},
	documentList: {
		marginTop: 0,
	},
	documentItem: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f5f5f5",
		padding: 10,
		borderRadius: 8,
		marginBottom: 15,
	},
	documentIcon: {
		marginRight: 10,
	},
	documentFilename: {
		flex: 1,
		fontSize: 14,
	},
});

export default EventDetails;
