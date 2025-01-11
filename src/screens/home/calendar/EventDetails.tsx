import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { subscribeCurrentUser } from "../../../controllers/userController";
import { subscribeEvent } from "../../../controllers/eventController";
import LoadingScreen from "../../LoadingScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import { TouchableOpacity } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import MapView, { Marker } from "react-native-maps";

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
			console.log(location);
			setMarkers((prev) => [
				...prev,
				{
					latitude: locations[location].latitude,
					longitude: locations[location].longitude,
					title: location,
				},
			]);
		}

		//console.log(markers);
	}, [event]);

	if (!event) return <LoadingScreen />;

	return (
		<SafeAreaView style={styles.container}>
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
								{moment(event.endTime, "HH:mm").format("h:mma")}
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
					<Text style={styles.label}>Location</Text>
					<MapView
						style={{ height: 300 }}
						// initialRegion={{
						// 	latitude: event.geo["latitude"],
						// 	longitude: event.geo["longitude"],
						// 	latitudeDelta: 0.00922,
						// 	longitudeDelta: 0.00421,
						// }}
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

					{event.notes && (
						<>
							<Text style={styles.label}>Notes</Text>
							<Text style={styles.text}>{event.notes}</Text>
						</>
					)}
				</View>
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
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
		color: "#666",
		marginBottom: 4,
	},
	text: {
		fontSize: 16,
		marginBottom: 12,
	},
});

export default EventDetails;
