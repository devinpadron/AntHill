import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	FlatList,
	TouchableOpacity,
	SafeAreaView,
	StatusBar,
	ActivityIndicator,
	Animated,
	Platform,
} from "react-native";
import { useUser } from "../../contexts/UserContext";
import { Ionicons } from "@expo/vector-icons";
import {
	confirmEvent,
	declineEvent,
	fetchUnassignedUpcomingEvents,
	undeclineEvent,
} from "../../services/availabilityService";

const TabIndicator = ({ activeTab }) => {
	// Animated tab indicator
	const [translateX] = useState(new Animated.Value(0));

	useEffect(() => {
		let position = 0;
		if (activeTab === "confirmed") position = 1;
		if (activeTab === "declined") position = 2;

		Animated.spring(translateX, {
			toValue: position,
			useNativeDriver: true,
			friction: 8,
		}).start();
	}, [activeTab]);

	return (
		<Animated.View
			style={[
				styles.tabIndicator,
				{
					transform: [
						{
							translateX: translateX.interpolate({
								inputRange: [0, 1, 2],
								outputRange: [0, 120, 240], // Adjust based on tab width
							}),
						},
					],
				},
			]}
		/>
	);
};

const AvailabilityPage = () => {
	const [activeTab, setActiveTab] = useState("unconfirmed");
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const { userId, companyId } = useUser();

	useEffect(() => {
		fetchEventsFromFirebase();
	}, [userId]);

	const fetchEventsFromFirebase = async () => {
		setLoading(true);

		try {
			// Get events from your service
			const fetchedEvents: any =
				await fetchUnassignedUpcomingEvents(companyId);

			if (fetchedEvents && fetchedEvents.length > 0) {
				// Transform the fetched events to match the UI requirements
				const formattedEvents = fetchedEvents.map((event) => {
					// Parse the start time to get a date object
					const startDate = new Date(event.startTime);

					// Format date to a user-friendly string
					const formattedDate = startDate.toLocaleDateString("en-US");

					// Format time (e.g., "4:17 PM")
					const timeOptions: Intl.DateTimeFormatOptions = {
						hour: "numeric",
						minute: "2-digit",
						hour12: true,
					};
					const formattedTime = startDate.toLocaleTimeString(
						"en-US",
						timeOptions,
					);

					// Set location (use event.locations if available)
					const location = event.locations
						? typeof event.locations === "string"
							? event.locations
							: "Multiple locations"
						: "Location TBD";

					// Check if user is in workerStatus map
					let status = "available";
					let confirmed = false;

					if (event.workerStatus && event.workerStatus[userId]) {
						const userStatus = event.workerStatus[userId];
						if (userStatus === "confirmed") {
							status = "already_on_event";
							confirmed = true;
						} else if (userStatus === "declined") {
							status = "on_potential_event";
							confirmed = false;
						}
					}

					return {
						id: event.id,
						date: formattedDate,
						time: formattedTime,
						location: location,
						title: event.title || "Unnamed Event",
						status: status,
						confirmed: confirmed,
						rawData: event,
					};
				});

				setEvents(formattedEvents);
			} else {
				// No events found
				setEvents([]);
			}
		} catch (error) {
			console.error("Error fetching events:", error);
			// Set fallback empty state
			setEvents([]);
		} finally {
			setLoading(false);
		}
	};

	const updateEventStatus = async (eventId, confirmed) => {
		// Firebase update will go here

		if (confirmed) {
			await confirmEvent(companyId, eventId, userId);
		} else {
			await declineEvent(companyId, eventId, userId);
		}

		// Mock update for now
		setEvents((prevEvents) =>
			prevEvents.map((event) =>
				event.id === eventId
					? {
							...event,
							confirmed,
							status: confirmed
								? "already_on_event"
								: "on_potential_event",
						}
					: event,
			),
		);
	};

	const getFilteredEvents = () => {
		switch (activeTab) {
			case "unconfirmed":
				// Only show available events that haven't been responded to yet
				return events.filter(
					(event) => event.status === "available" && !event.confirmed,
				);
			case "confirmed":
				return events.filter((event) => event.confirmed === true);
			case "declined":
				return events.filter(
					(event) =>
						event.confirmed === false &&
						event.status !== "available",
				);
			default:
				return events;
		}
	};

	const renderEventCard = ({ item }) => {
		const getStatusColor = () => {
			switch (item.status) {
				case "available":
					return "#4ADE80";
				case "already_on_event":
					return "#EF4444";
				default:
					return "#888888";
			}
		};

		const getStatusText = () => {
			switch (item.status) {
				case "available":
					return "Available";
				case "already_on_event":
					return "Already on Event";
				default:
					return "";
			}
		};

		const getStatusIcon = () => {
			switch (item.status) {
				case "available":
					return "checkmark-circle";
				case "already_on_event":
					return "calendar";
				default:
					return "help-circle";
			}
		};

		const handleConfirm = () => {
			updateEventStatus(item.id, true);
		};

		const handleDecline = () => {
			updateEventStatus(item.id, false);
		};

		const handleUndecline = () => {
			// Change status from declined/on_potential_event back to available
			undeclineEvent(companyId, item.id, userId);

			setEvents((prevEvents) =>
				prevEvents.map((event) =>
					event.id === item.id
						? { ...event, status: "available", confirmed: false }
						: event,
				),
			);
		};

		// Only show status badge on the Unconfirmed tab
		const showStatusBadge = activeTab === "unconfirmed";

		// Only show colored border on the Unconfirmed tab
		const cardStyle =
			activeTab === "unconfirmed"
				? [styles.eventCard, { borderLeftColor: getStatusColor() }]
				: styles.eventCard;

		return (
			<Animated.View style={cardStyle}>
				<View style={styles.eventHeader}>
					<View style={styles.dateLocationContainer}>
						<Text style={styles.eventTitle}>{item.title}</Text>
						<Text style={styles.eventDate}>{item.date}</Text>
						<Text style={styles.eventTime}>{item.time}</Text>
						<View style={styles.locationContainer}>
							<Ionicons name="location" size={14} color="#666" />
							<Text style={styles.eventLocation}>
								{item.location}
							</Text>
						</View>
					</View>

					{/* Only show status badge on Unconfirmed tab */}
					{showStatusBadge && (
						<View
							style={[
								styles.statusBadge,
								{ backgroundColor: getStatusColor() },
							]}
						>
							<Ionicons
								name={getStatusIcon()}
								size={14}
								color="#fff"
								style={styles.statusIcon}
							/>
							<Text style={styles.statusBadgeText}>
								{getStatusText()}
							</Text>
						</View>
					)}
				</View>

				{/* Show action buttons based on tab and status */}
				{activeTab === "unconfirmed" && item.status === "available" && (
					<View style={styles.buttonContainer}>
						<TouchableOpacity
							style={styles.declineButton}
							onPress={handleDecline}
							activeOpacity={0.7}
						>
							<Ionicons
								name="close-circle"
								size={16}
								color="#fff"
							/>
							<Text style={styles.buttonText}>Decline</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.confirmButton}
							onPress={handleConfirm}
							activeOpacity={0.7}
						>
							<Ionicons
								name="checkmark-circle"
								size={16}
								color="#fff"
							/>
							<Text style={styles.buttonText}>Confirm</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Show Undecline button on the Declined tab */}
				{activeTab === "declined" && (
					<View style={styles.buttonContainer}>
						<TouchableOpacity
							style={styles.undeclineButton}
							onPress={handleUndecline}
							activeOpacity={0.7}
						>
							<Ionicons name="refresh" size={16} color="#fff" />
							<Text style={styles.buttonText}>Undecline</Text>
						</TouchableOpacity>
					</View>
				)}
			</Animated.View>
		);
	};

	const renderEmptyState = () => (
		<View style={styles.emptyStateContainer}>
			<Ionicons name="calendar-outline" size={64} color="#ccc" />
			<Text style={styles.emptyStateTitle}>No Events Found</Text>
			<Text style={styles.emptyStateDescription}>
				No {activeTab} events to display at this time
			</Text>
		</View>
	);

	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="dark-content" />

			<View style={styles.header}>
				<Text style={styles.title}>Availability</Text>
			</View>

			<View style={styles.tabOuterContainer}>
				<View style={styles.tabContainer}>
					<TouchableOpacity
						style={[
							styles.tab,
							activeTab === "unconfirmed" && styles.activeTab,
						]}
						onPress={() => setActiveTab("unconfirmed")}
						activeOpacity={0.7}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "unconfirmed" &&
									styles.activeTabText,
							]}
						>
							Unconfirmed
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={[
							styles.tab,
							activeTab === "confirmed" && styles.activeTab,
						]}
						onPress={() => setActiveTab("confirmed")}
						activeOpacity={0.7}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "confirmed" &&
									styles.activeTabText,
							]}
						>
							Confirmed
						</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={[
							styles.tab,
							activeTab === "declined" && styles.activeTab,
						]}
						onPress={() => setActiveTab("declined")}
						activeOpacity={0.7}
					>
						<Text
							style={[
								styles.tabText,
								activeTab === "declined" &&
									styles.activeTabText,
							]}
						>
							Declined
						</Text>
					</TouchableOpacity>

					<TabIndicator activeTab={activeTab} />
				</View>
			</View>

			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#4A90E2" />
					<Text style={styles.loadingText}>Loading events...</Text>
				</View>
			) : (
				<FlatList
					data={getFilteredEvents()}
					renderItem={renderEventCard}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.eventList}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={renderEmptyState}
				/>
			)}
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F9FAFB",
	},
	header: {
		padding: 16,
		paddingTop: 12,
		paddingBottom: 8,
		alignItems: "center",
		backgroundColor: "#fff",
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 1 },
				shadowOpacity: 0.1,
				shadowRadius: 2,
			},
			android: {
				elevation: 2,
			},
		}),
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		color: "#1F2937",
		letterSpacing: 0.5,
	},
	tabOuterContainer: {
		backgroundColor: "#fff",
		paddingHorizontal: 16,
		marginBottom: 16,
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 1 },
				shadowOpacity: 0.05,
				shadowRadius: 1,
			},
			android: {
				elevation: 1,
			},
		}),
	},
	tabContainer: {
		flexDirection: "row",
		position: "relative",
		height: 48,
	},
	tab: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	activeTab: {},
	tabText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#6B7280",
	},
	activeTabText: {
		color: "#4A90E2",
		fontWeight: "700",
	},
	tabIndicator: {
		position: "absolute",
		bottom: 0,
		width: 120, // Adjust based on screen width and number of tabs
		height: 3,
		backgroundColor: "#4A90E2",
		borderRadius: 3,
	},
	eventList: {
		paddingHorizontal: 16,
		paddingBottom: 20,
	},
	eventCard: {
		backgroundColor: "#FFFFFF",
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 2 },
				shadowOpacity: 0.06,
				shadowRadius: 4,
			},
			android: {
				elevation: 2,
			},
		}),
	},
	eventHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
	},
	dateLocationContainer: {
		flex: 1,
	},
	eventDate: {
		fontSize: 16,
		fontWeight: "700",
		color: "#1F2937",
		marginBottom: 4,
	},
	eventTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#1F2937",
		marginBottom: 4,
	},
	eventTime: {
		fontSize: 14,
		color: "#4B5563",
		marginBottom: 4,
	},
	locationContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	eventLocation: {
		fontSize: 14,
		color: "#6B7280",
		marginLeft: 4,
	},
	statusBadge: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		marginLeft: 8,
	},
	statusIcon: {
		marginRight: 4,
	},
	statusBadgeText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	buttonContainer: {
		flexDirection: "row",
		marginTop: 16,
		justifyContent: "flex-end",
	},
	confirmButton: {
		backgroundColor: "#4ADE80",
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
		marginLeft: 12,
	},
	declineButton: {
		backgroundColor: "#EF4444",
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	undeclineButton: {
		backgroundColor: "#6366F1", // Indigo color
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 8,
	},
	buttonText: {
		color: "#FFFFFF",
		fontWeight: "600",
		fontSize: 14,
		marginLeft: 6,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		color: "#6B7280",
	},
	emptyStateContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
		paddingVertical: 64,
	},
	emptyStateTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#374151",
		marginTop: 16,
	},
	emptyStateDescription: {
		fontSize: 14,
		color: "#6B7280",
		textAlign: "center",
		marginTop: 8,
	},
});

export default AvailabilityPage;
