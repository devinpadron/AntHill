import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, ScrollView } from "react-native";
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

type RootStackParamList = {
	EventDetails: {
		uid: string;
	};
};

type EventDetailsRouteProp = RouteProp<RootStackParamList, "EventDetails">;

const EventDetails = ({ navigation }) => {
	const route = useRoute<EventDetailsRouteProp>();
	if (!route.params) return null;

	const [user, setUser] = useState(null);
	const [event, setEvent] = useState(null);
	const [markers, setMarkers] = useState([]);
	const [workerList, setWorkerList] = useState("");

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
		const locations = event.locations;
		if (!locations) return;
		for (let location in locations) {
			setMarkers((prev) => [
				...prev,
				{
					latitude: locations[location].latitude,
					longitude: locations[location].longitude,
					title: location,
				},
			]);
		}
	}, [event]);

	useEffect(() => {
		if (!event) return;
		const getWorkerList = async () => {
			const assignedWorkers = event.assignedWorkers;
			let workerList = "";
			for (let i = 0; i < assignedWorkers.length; i++) {
				const workerData = await getUser(assignedWorkers[i]);
				workerList += workerData.firstName + " " + workerData.lastName;
				if (i < assignedWorkers.length - 1) workerList += ", ";
			}
			setWorkerList(workerList);
		};
		getWorkerList();
	}, [event]);

	const getRegionForMarkers = (markers) => {
		if (!markers || markers.length === 0) return null;

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

	if (!event) return <LoadingScreen />;

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView
				ref={scrollViewRef}
				contentContainerStyle={{ flexGrow: 1 }}
			>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						<Ionicons name="chevron-back" size={28} color="#000" />
					</TouchableOpacity>
					<Text style={styles.title}>{event.title}</Text>
				</View>

				<View style={styles.content}>
					<View style={[styles.timeSection, { marginBottom: 10 }]}>
						<Text style={styles.timeText}>
							{moment(event.date).format("dddd, MMMM D, YYYY")}
						</Text>
					</View>
					<View style={styles.timeSection}>
						<Text style={styles.timeText}>
							{moment(event.startTime, "HH:mm").format("h:mma")}
						</Text>

						{event.endTime && (
							<>
								<Text style={styles.timeText}>-</Text>
								<Text style={styles.timeText}>
									{moment(event.endTime, "HH:mm").format(
										"h:mma"
									)}
								</Text>
							</>
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
								initialRegion={getRegionForMarkers(markers)}
							>
								{markers.map((marker, index) => (
									<Marker
										key={index}
										coordinate={{
											latitude: marker.latitude,
											longitude: marker.longitude,
										}}
										title={marker.title}
									/>
								))}
							</MapView>
						)}
					</View>

					<Text style={styles.label}>Your Notes</Text>
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
						value={event.userNotes || ""}
						onChangeText={(text) => {
							const updatedEvent = {
								...event,
								userNotes: text,
							};
							updateEvent(
								user.loggedInCompany,
								route.params.uid,
								updatedEvent
							);
							setEvent(updatedEvent);
							scrollViewRef.current.scrollToEnd({
								animated: true,
							});
						}}
						placeholder="Add your personal notes here..."
					/>
				</View>
			</ScrollView>
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
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
	},
	backButton: {
		padding: 8,
	},
	title: {
		flex: 1,
		fontSize: 20,
		fontWeight: "bold",
		textAlign: "center",
		marginRight: 44, // To center the title accounting for back button
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
});

export default EventDetails;
