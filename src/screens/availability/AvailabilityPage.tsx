import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	FlatList,
	TouchableOpacity,
	SafeAreaView,
	ActivityIndicator,
	Animated,
	Platform,
	Modal,
	TextInput,
	KeyboardAvoidingView,
	ScrollView,
	Alert,
	Switch,
	Dimensions,
} from "react-native";
import { useUser } from "../../contexts/UserContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import {
	confirmEvent,
	declineEvent,
	fetchUnassignedUpcomingEvents,
	undeclineEvent,
	getWorkerStatusList,
} from "../../services/availabilityService";
import {
	updateCompanyPreferences,
	getCompanyPreferences,
} from "../../services/companyService";
import { fetchUpcomingEventsForUser } from "../../services/availabilityService"; // Add this import
import { getAllUsersInCompany } from "../../services/companyService"; // Import the new service
import { User } from "../../types";

const { width: screenWidth } = Dimensions.get("window");

const TabIndicator = ({ activeTab }) => {
	// Animated tab indicator
	const [translateX] = useState(new Animated.Value(0));

	useEffect(() => {
		let position = 0;
		if (activeTab === "confirmed") position = 1;
		if (activeTab === "declined") position = 2;

		// Calculate tab width and indicator width
		const tabWidth = (screenWidth - 32) / 3; // 32 for horizontal padding
		const indicatorWidth = tabWidth * 0.6; // 60% of tab width
		const centerOffset = (tabWidth - indicatorWidth) / 2;

		Animated.spring(translateX, {
			toValue: position * tabWidth + centerOffset,
			useNativeDriver: true,
			friction: 8,
		}).start();
	}, [activeTab]);

	const tabWidth = (screenWidth - 32) / 3;
	const indicatorWidth = tabWidth * 0.6;

	return (
		<Animated.View
			style={[
				styles.tabIndicator,
				{
					width: indicatorWidth,
					transform: [{ translateX }],
				},
			]}
		/>
	);
};

const AvailabilityPage = ({ navigation }) => {
	const [activeTab, setActiveTab] = useState("unconfirmed");
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [reminderModalVisible, setReminderModalVisible] = useState(false);
	const [reminderHours, setReminderHours] = useState("24");
	const [reminderMinutes, setReminderMinutes] = useState("0");
	const [remindersEnabled, setRemindersEnabled] = useState(true);
	const [adminModalVisible, setAdminModalVisible] = useState(false);
	const [selectedEventForAdmin, setSelectedEventForAdmin] = useState(null);
	const [eventWorkerDetails, setEventWorkerDetails] = useState({
		confirmed: [],
		declined: [],
		unconfirmed: [],
	});
	const [loadingWorkerDetails, setLoadingWorkerDetails] = useState(false);
	const { userId, companyId, isAdmin } = useUser();

	// Refresh data every time the screen comes into focus
	useFocusEffect(
		React.useCallback(() => {
			fetchEventsFromFirebase();
		}, [userId, companyId]),
	);

	useEffect(() => {
		fetchEventsFromFirebase();
	}, [userId]);

	const fetchEventsFromFirebase = async () => {
		setLoading(true);

		try {
			// Get unassigned events from your service
			const fetchedEvents: any =
				await fetchUnassignedUpcomingEvents(companyId);

			// Get assigned events for the current user to check for conflicts
			const assignedEvents: any = await fetchUpcomingEventsForUser(
				companyId,
				userId,
			);

			if (fetchedEvents && fetchedEvents.length > 0) {
				// Create a set of dates where the user already has assigned events
				const assignedEventDates = new Set(
					assignedEvents?.map((event) => {
						return event.date; // Use the date string directly for comparison
					}) || [],
				);

				// Transform the fetched events to match the UI requirements
				const formattedEvents = fetchedEvents.map((event) => {
					// Use the date string directly from Firebase (YYYY-MM-DD format)
					const eventDateString = event.date;

					// Parse the date string correctly to avoid timezone issues
					const [year, month, day] = event.date.split("-");
					const eventDate = new Date(
						parseInt(year),
						parseInt(month) - 1,
						parseInt(day),
					);

					// Format date to a user-friendly string - UPDATE THIS PART:
					const formattedDate = eventDate.toLocaleDateString(
						"en-US",
						{
							weekday: "short", // Mon, Tue, Wed, etc.
							month: "short", // Jan, Feb, Mar, etc.
							day: "numeric", // 1, 2, 3, etc.
							year: "numeric", // 2024, 2025, etc.
						},
					);

					// Set location based on event.locations map (address -> {lat, lng})
					let location = "Location TBD";
					if (event.locations) {
						const locationKeys = Object.keys(event.locations);
						if (locationKeys.length === 1) {
							location = locationKeys[0]; // Use the address (the key) as location
						} else if (locationKeys.length > 1) {
							location = "Multiple locations";
						}
					}

					// Check if user is in workerStatus map
					let status = "available";
					let confirmed = false;

					if (event.workerStatus && event.workerStatus[userId]) {
						const userStatus = event.workerStatus[userId];
						if (userStatus === "confirmed") {
							status = "on_potential_event";
							confirmed = true;
						} else if (userStatus === "declined") {
							status = "on_potential_event";
							confirmed = false;
						}
					}

					// Check if user is already assigned to another event on the same day
					// Only override status if user hasn't responded to this event yet
					if (
						assignedEventDates.has(eventDateString) &&
						status === "available"
					) {
						status = "already_on_event";
						// Don't change confirmed status - keep it false so it shows in unconfirmed tab
					}

					return {
						id: event.id,
						date: formattedDate,
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
				// Show available events and already_on_event events that haven't been responded to
				return events.filter(
					(event) =>
						(event.status === "available" ||
							event.status === "already_on_event") &&
						!event.confirmed,
				);
			case "confirmed":
				return events.filter((event) => event.confirmed === true);
			case "declined":
				return events.filter(
					(event) =>
						event.confirmed === false &&
						event.status === "on_potential_event",
				);
			default:
				return events;
		}
	};

	const renderEventCard = ({ item }) => {
		const getStatusColor = () => {
			if (activeTab === "confirmed") {
				return "#4ADE80";
			} else if (activeTab === "declined") {
				return "#EF4444";
			}
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
			if (activeTab === "confirmed") {
				return "Confirmed";
			} else if (activeTab === "declined") {
				return "Declined";
			} else {
				// Unconfirmed tab
				switch (item.status) {
					case "available":
						return "Available";
					case "already_on_event":
						return "Already on Event";
					default:
						return "";
				}
			}
		};

		const getStatusIcon = () => {
			if (activeTab === "confirmed") {
				return "checkmark-circle";
			} else if (activeTab === "declined") {
				return "close-circle";
			} else {
				// Unconfirmed tab
				switch (item.status) {
					case "available":
						return "checkmark-circle";
					case "already_on_event":
						return "calendar";
					default:
						return "help-circle";
				}
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

		// Show status badge on all tabs
		const showStatusBadge = true;

		// Only show colored border on the Unconfirmed tab
		const cardStyle =
			activeTab === "unconfirmed"
				? [styles.eventCard, { borderLeftColor: getStatusColor() }]
				: styles.eventCard;

		return (
			<Animated.View style={cardStyle}>
				<TouchableOpacity
					onPress={
						isAdmin ? () => handleAdminEventPress(item) : undefined
					}
					activeOpacity={isAdmin ? 0.7 : 1}
				>
					<View style={styles.eventHeader}>
						<View style={styles.dateLocationContainer}>
							<Text style={styles.eventTitle}>{item.title}</Text>
							<Text style={styles.eventDate}>{item.date}</Text>
							<View style={styles.locationContainer}>
								<Ionicons
									name="location"
									size={14}
									color="#666"
								/>
								<Text style={styles.eventLocation}>
									{item.location}
								</Text>
							</View>
						</View>

						{/* Show status badge on all tabs */}
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

					{/* Show action buttons for available and already_on_event status */}
					{activeTab === "unconfirmed" &&
						(item.status === "available" ||
							item.status === "already_on_event") && (
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
									<Text style={styles.buttonText}>
										Decline
									</Text>
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
									<Text style={styles.buttonText}>
										Confirm
									</Text>
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
								<Ionicons
									name="refresh"
									size={16}
									color="#fff"
								/>
								<Text style={styles.buttonText}>Undecline</Text>
							</TouchableOpacity>
						</View>
					)}
				</TouchableOpacity>
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

	const handleReminderSettings = async () => {
		try {
			// Fetch current company preferences
			const preferences = await getCompanyPreferences(companyId);

			// Set current values
			const currentHours = preferences?.availabilityReminderHours || 24;
			const currentMinutes =
				preferences?.availabilityReminderMinutes || 0;
			const currentEnabled =
				preferences?.availabilityReminderEnabled !== false; // Default to true if undefined

			setReminderHours(currentHours.toString());
			setReminderMinutes(currentMinutes.toString());
			setRemindersEnabled(currentEnabled);
			setReminderModalVisible(true);
		} catch (error) {
			console.error("Error fetching reminder preferences:", error);
		}
	};

	const saveReminderSettings = async () => {
		try {
			const hours = parseInt(reminderHours) || 24;
			const minutes = parseInt(reminderMinutes) || 0;

			await updateCompanyPreferences(companyId, {
				availabilityReminderHours: hours,
				availabilityReminderMinutes: minutes,
				availabilityReminderEnabled: remindersEnabled,
			});

			setReminderModalVisible(false);
			Alert.alert("Success", "Reminder settings updated successfully!");
		} catch (error) {
			console.error("Error saving reminder preferences:", error);
			Alert.alert("Error", "Failed to save reminder settings");
		}
	};

	// Add this function before your return statement
	const fetchEventWorkerDetails = async (event) => {
		setLoadingWorkerDetails(true);
		try {
			// Get all users in the company (returns a map)
			const usersMap = await getAllUsersInCompany(companyId);

			// Convert the map to an array of users
			const allUsers = Object.values(usersMap);

			// Fetch fresh worker status from Firebase instead of using stale local data
			const workerStatus = await getWorkerStatusList(companyId, event.id);

			// Categorize users based on their status in the workerStatus map
			const categorizedUsers = {
				confirmed: [],
				declined: [],
				unconfirmed: [],
			};

			allUsers.forEach((user: User) => {
				const userStatus = workerStatus[user.id];

				const userWithStatus = {
					...user,
					status: userStatus || "available", // No status means they're available
				};

				if (userStatus === "confirmed") {
					categorizedUsers.confirmed.push(userWithStatus);
				} else if (userStatus === "declined") {
					categorizedUsers.declined.push(userWithStatus);
				} else if (userStatus === "pending") {
					// User has been notified but hasn't responded
					categorizedUsers.unconfirmed.push({
						...userWithStatus,
						status: "pending",
					});
				} else {
					// User has no status in the map - they're available
					categorizedUsers.unconfirmed.push({
						...userWithStatus,
						status: "pending",
					});
				}
			});

			setEventWorkerDetails(categorizedUsers);
		} catch (error) {
			console.error("Error fetching worker details:", error);
		} finally {
			setLoadingWorkerDetails(false);
		}
	};

	const handleAdminStatusChange = async (targetUserId, newStatus) => {
		if (!selectedEventForAdmin) return;
		const eventId = selectedEventForAdmin.id;

		if (newStatus === "confirmed") {
			await confirmEvent(companyId, eventId, targetUserId);
		} else if (newStatus === "declined") {
			await declineEvent(companyId, eventId, targetUserId);
		}

		// Refresh worker details in the modal
		fetchEventWorkerDetails(selectedEventForAdmin);
		// Refresh the main event list
		fetchEventsFromFirebase();
	};

	const handleAdminEventPress = (event) => {
		setSelectedEventForAdmin(event);
		setAdminModalVisible(true);
		fetchEventWorkerDetails(event);
	};

	// Update the header to include admin button
	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Availability</Text>
				{/* Show admin button if user is admin */}
				{isAdmin && (
					<TouchableOpacity
						style={styles.adminButton}
						onPress={handleReminderSettings}
						activeOpacity={0.7}
					>
						<Ionicons
							name="notifications-outline"
							size={20}
							color="#4A90E2"
						/>
						<Text style={styles.adminButtonText}>Reminders</Text>
					</TouchableOpacity>
				)}
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

			{/* Add the reminder modal */}
			<Modal
				visible={reminderModalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={() => setReminderModalVisible(false)}
			>
				<KeyboardAvoidingView
					style={styles.modalOverlay}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View style={styles.modalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>
								Set Availability Reminder
							</Text>
							<TouchableOpacity
								onPress={() => setReminderModalVisible(false)}
								style={styles.closeButton}
							>
								<Ionicons
									name="close"
									size={24}
									color="#6B7280"
								/>
							</TouchableOpacity>
						</View>

						<ScrollView style={styles.modalBody}>
							<Text style={styles.modalDescription}>
								Configure when and how often workers should be
								reminded to confirm their availability.
							</Text>

							{/* Toggle Switch for Reminders */}
							<View style={styles.toggleContainer}>
								<View style={styles.toggleLabelContainer}>
									<Text style={styles.toggleLabel}>
										Enable Reminders
									</Text>
									<Text style={styles.toggleSubLabel}>
										Send automatic reminders to workers
									</Text>
								</View>
								<Switch
									value={remindersEnabled}
									onValueChange={setRemindersEnabled}
									trackColor={{
										false: "#E5E7EB",
										true: "#93C5FD",
									}}
									thumbColor={
										remindersEnabled ? "#4A90E2" : "#F3F4F6"
									}
									ios_backgroundColor="#E5E7EB"
								/>
							</View>

							{/* Time inputs - only show when reminders are enabled */}
							{remindersEnabled && (
								<>
									<Text style={styles.sectionLabel}>
										Reminder Frequency
									</Text>
									<View style={styles.timeInputContainer}>
										<View style={styles.inputGroup}>
											<Text style={styles.inputLabel}>
												Hours
											</Text>
											<TextInput
												style={styles.timeInput}
												value={reminderHours}
												onChangeText={setReminderHours}
												keyboardType="numeric"
												placeholder="24"
											/>
										</View>

										<Text style={styles.timeSeparator}>
											:
										</Text>

										<View style={styles.inputGroup}>
											<Text style={styles.inputLabel}>
												Minutes
											</Text>
											<TextInput
												style={styles.timeInput}
												value={reminderMinutes}
												onChangeText={
													setReminderMinutes
												}
												keyboardType="numeric"
												placeholder="0"
											/>
										</View>
									</View>

									<Text style={styles.previewText}>
										Workers will be reminded every{" "}
										{reminderHours || "24"} hours and{" "}
										{reminderMinutes || "0"} minutes until
										they confirm or decline their event.
									</Text>
								</>
							)}

							{/* Disabled state message */}
							{!remindersEnabled && (
								<Text style={styles.disabledText}>
									Reminders are disabled. Workers will not
									receive automatic notifications to confirm
									their availability.
								</Text>
							)}
						</ScrollView>

						<View style={styles.modalFooter}>
							<TouchableOpacity
								style={styles.cancelButton}
								onPress={() => setReminderModalVisible(false)}
							>
								<Text style={styles.cancelButtonText}>
									Cancel
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.saveButton}
								onPress={saveReminderSettings}
							>
								<Text style={styles.saveButtonText}>
									Save Settings
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>

			{/* Admin modal for event details - new feature */}
			<Modal
				visible={adminModalVisible}
				transparent={true}
				animationType="slide"
				onRequestClose={() => setAdminModalVisible(false)}
			>
				<KeyboardAvoidingView
					style={styles.modalOverlay}
					behavior={Platform.OS === "ios" ? "padding" : "height"}
				>
					<View style={styles.adminModalContent}>
						<View style={styles.modalHeader}>
							<Text style={styles.modalTitle}>
								Event Worker Status
							</Text>
							<TouchableOpacity
								onPress={() => setAdminModalVisible(false)}
								style={styles.closeButton}
							>
								<Ionicons
									name="close"
									size={24}
									color="#6B7280"
								/>
							</TouchableOpacity>
						</View>

						{selectedEventForAdmin && (
							<View style={styles.eventInfoHeader}>
								<Text style={styles.eventInfoTitle}>
									{selectedEventForAdmin.title}
								</Text>
								<Text style={styles.eventInfoDate}>
									{selectedEventForAdmin.date}
								</Text>
								<Text style={styles.eventInfoLocation}>
									📍 {selectedEventForAdmin.location}
								</Text>
							</View>
						)}

						<ScrollView style={styles.adminModalBody}>
							{loadingWorkerDetails ? (
								<View style={styles.loadingContainer}>
									<ActivityIndicator
										size="large"
										color="#4A90E2"
									/>
									<Text style={styles.loadingText}>
										Loading worker details...
									</Text>
								</View>
							) : (
								<>
									{/* Confirmed Users */}
									<View style={styles.workerSection}>
										<View style={styles.sectionHeaderRow}>
											<Ionicons
												name="checkmark-circle"
												size={20}
												color="#4ADE80"
											/>
											<Text style={styles.sectionTitle}>
												Confirmed (
												{
													eventWorkerDetails.confirmed
														.length
												}
												)
											</Text>
										</View>
										{eventWorkerDetails.confirmed.length >
										0 ? (
											eventWorkerDetails.confirmed.map(
												(user, index) => (
													<View
														key={index}
														style={
															styles.workerItem
														}
													>
														<Text
															style={
																styles.workerName
															}
														>
															{user.firstName}{" "}
															{user.lastName}
														</Text>
														<View
															style={
																styles.workerItemActions
															}
														>
															<TouchableOpacity
																style={
																	styles.adminDeclineBtn
																}
																onPress={() =>
																	handleAdminStatusChange(
																		user.id,
																		"declined",
																	)
																}
															>
																<Ionicons
																	name="close-circle"
																	size={14}
																	color="#fff"
																/>
																<Text
																	style={
																		styles.adminBtnText
																	}
																>
																	Decline
																</Text>
															</TouchableOpacity>
														</View>
													</View>
												),
											)
										) : (
											<Text style={styles.emptyText}>
												No confirmed workers
											</Text>
										)}
									</View>

									{/* Unconfirmed Users */}
									<View style={styles.workerSection}>
										<View style={styles.sectionHeaderRow}>
											<Ionicons
												name="help-circle-outline"
												size={20}
												color="#F59E0B"
											/>
											<Text style={styles.sectionTitle}>
												Unconfirmed (
												{
													eventWorkerDetails
														.unconfirmed.length
												}
												)
											</Text>
										</View>
										{eventWorkerDetails.unconfirmed.length >
										0 ? (
											eventWorkerDetails.unconfirmed.map(
												(user, index) => (
													<View
														key={index}
														style={
															styles.workerItem
														}
													>
														<Text
															style={
																styles.workerName
															}
														>
															{user.firstName}{" "}
															{user.lastName}
														</Text>
														<View
															style={
																styles.workerItemActions
															}
														>
															<TouchableOpacity
																style={
																	styles.adminDeclineBtn
																}
																onPress={() =>
																	handleAdminStatusChange(
																		user.id,
																		"declined",
																	)
																}
															>
																<Ionicons
																	name="close-circle"
																	size={14}
																	color="#fff"
																/>
																<Text
																	style={
																		styles.adminBtnText
																	}
																>
																	Decline
																</Text>
															</TouchableOpacity>
															<TouchableOpacity
																style={
																	styles.adminConfirmBtn
																}
																onPress={() =>
																	handleAdminStatusChange(
																		user.id,
																		"confirmed",
																	)
																}
															>
																<Ionicons
																	name="checkmark-circle"
																	size={14}
																	color="#fff"
																/>
																<Text
																	style={
																		styles.adminBtnText
																	}
																>
																	Confirm
																</Text>
															</TouchableOpacity>
														</View>
													</View>
												),
											)
										) : (
											<Text style={styles.emptyText}>
												No unconfirmed workers
											</Text>
										)}
									</View>

									{/* Declined Users */}
									<View style={styles.workerSection}>
										<View style={styles.sectionHeaderRow}>
											<Ionicons
												name="close-circle-outline"
												size={20}
												color="#EF4444"
											/>
											<Text style={styles.sectionTitle}>
												Declined (
												{
													eventWorkerDetails.declined
														.length
												}
												)
											</Text>
										</View>
										{eventWorkerDetails.declined.length >
										0 ? (
											eventWorkerDetails.declined.map(
												(user, index) => (
													<View
														key={index}
														style={
															styles.workerItem
														}
													>
														<Text
															style={
																styles.workerName
															}
														>
															{user.firstName}{" "}
															{user.lastName}
														</Text>
														<View
															style={
																styles.workerItemActions
															}
														>
															<TouchableOpacity
																style={
																	styles.adminConfirmBtn
																}
																onPress={() =>
																	handleAdminStatusChange(
																		user.id,
																		"confirmed",
																	)
																}
															>
																<Ionicons
																	name="checkmark-circle"
																	size={14}
																	color="#fff"
																/>
																<Text
																	style={
																		styles.adminBtnText
																	}
																>
																	Confirm
																</Text>
															</TouchableOpacity>
														</View>
													</View>
												),
											)
										) : (
											<Text style={styles.emptyText}>
												No declined workers
											</Text>
										)}
									</View>
								</>
							)}
						</ScrollView>

						<View style={styles.adminModalFooter}>
							<TouchableOpacity
								style={styles.closeModalButton}
								onPress={() => setAdminModalVisible(false)}
							>
								<Text style={styles.closeModalButtonText}>
									Close
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.openEventButton}
								onPress={() => {
									setAdminModalVisible(false);
									navigation.navigate("EventDetails", {
										eventId: selectedEventForAdmin.id,
									});
								}}
							>
								<Text style={styles.openEventButtonText}>
									Open Event
								</Text>
							</TouchableOpacity>
						</View>
					</View>
				</KeyboardAvoidingView>
			</Modal>
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
	adminButton: {
		position: "absolute",
		right: 16,
		top: 12,
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#F3F4F6",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 20,
	},
	adminButtonText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#4A90E2",
		marginLeft: 4,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	modalContent: {
		backgroundColor: "#FFFFFF",
		borderRadius: 16,
		width: "90%",
		maxHeight: "80%",
		overflow: "hidden",
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: "#E5E7EB",
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#1F2937",
	},
	closeButton: {
		padding: 4,
	},
	modalBody: {
		padding: 20,
	},
	modalDescription: {
		fontSize: 14,
		color: "#6B7280",
		marginBottom: 20,
		lineHeight: 20,
	},
	timeInputContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 20,
	},
	inputGroup: {
		alignItems: "center",
	},
	inputLabel: {
		fontSize: 12,
		fontWeight: "600",
		color: "#6B7280",
		marginBottom: 8,
	},
	timeInput: {
		borderWidth: 2,
		borderColor: "#E5E7EB",
		borderRadius: 8,
		padding: 12,
		fontSize: 18,
		fontWeight: "600",
		textAlign: "center",
		width: 80,
		backgroundColor: "#F9FAFB",
	},
	timeSeparator: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#6B7280",
		marginHorizontal: 16,
	},
	previewText: {
		fontSize: 13,
		color: "#4B5563",
		textAlign: "center",
		backgroundColor: "#F3F4F6",
		padding: 12,
		borderRadius: 8,
	},
	modalFooter: {
		flexDirection: "row",
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: "#E5E7EB",
	},
	cancelButton: {
		flex: 1,
		paddingVertical: 12,
		marginRight: 8,
		backgroundColor: "#F3F4F6",
		borderRadius: 8,
		alignItems: "center",
	},
	cancelButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#6B7280",
	},
	saveButton: {
		flex: 1,
		paddingVertical: 12,
		marginLeft: 8,
		backgroundColor: "#4A90E2",
		borderRadius: 8,
		alignItems: "center",
	},
	saveButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	toggleContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 16,
		paddingHorizontal: 16,
		backgroundColor: "#F9FAFB",
		borderRadius: 12,
		marginBottom: 24,
	},
	toggleLabelContainer: {
		flex: 1,
		marginRight: 16,
	},
	toggleLabel: {
		fontSize: 16,
		fontWeight: "600",
		color: "#1F2937",
		marginBottom: 2,
	},
	toggleSubLabel: {
		fontSize: 13,
		color: "#6B7280",
	},
	sectionLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: "#374151",
		marginBottom: 12,
	},
	disabledText: {
		fontSize: 14,
		color: "#6B7280",
		textAlign: "center",
		backgroundColor: "#FEF3C7",
		padding: 16,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#F59E0B",
		marginTop: 16,
	},
	// New styles for admin event details modal
	eventDetailsContainer: {
		marginBottom: 24,
	},
	eventDetailsTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#1F2937",
		marginBottom: 8,
	},
	eventDetailsDate: {
		fontSize: 14,
		color: "#6B7280",
		marginBottom: 4,
	},
	eventDetailsLocation: {
		fontSize: 14,
		color: "#6B7280",
		marginBottom: 16,
	},
	workerDetailsContainer: {
		backgroundColor: "#F9FAFB",
		borderRadius: 12,
		padding: 16,
	},
	workerDetailsTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#374151",
		marginBottom: 12,
	},
	workerGroup: {
		marginBottom: 16,
	},
	workerGroupTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: "#1F2937",
		marginBottom: 8,
	},
	workerCard: {
		backgroundColor: "#FFFFFF",
		borderRadius: 8,
		padding: 12,
		marginBottom: 8,
		...Platform.select({
			ios: {
				shadowColor: "#000",
				shadowOffset: { width: 0, height: 2 },
				shadowOpacity: 0.05,
				shadowRadius: 4,
			},
			android: {
				elevation: 2,
			},
		}),
	},
	workerName: {
		fontSize: 14,
		fontWeight: "500",
		color: "#374151",
		flex: 1,
	},
	workerStatus: {
		fontSize: 13,
		color: "#6B7280",
		marginTop: 4,
	},
	adminModalContent: {
		backgroundColor: "#FFFFFF",
		borderRadius: 16,
		width: "95%",
		maxHeight: "90%",
		overflow: "hidden",
	},
	adminModalBody: {
		maxHeight: 400,
	},
	eventInfoHeader: {
		padding: 20,
		backgroundColor: "#F9FAFB",
		borderBottomWidth: 1,
		borderBottomColor: "#E5E7EB",
	},
	eventInfoTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: "#1F2937",
		marginBottom: 4,
	},
	eventInfoDate: {
		fontSize: 14,
		color: "#6B7280",
		marginBottom: 2,
	},
	eventInfoLocation: {
		fontSize: 14,
		color: "#6B7280",
	},
	workerSection: {
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#F3F4F6",
	},
	sectionHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#374151",
		marginLeft: 8,
	},
	workerItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 12,
		backgroundColor: "#F9FAFB",
		borderRadius: 8,
		marginBottom: 8,
	},
	workerItemActions: {
		flexDirection: "row",
		gap: 8,
	},
	adminConfirmBtn: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#4ADE80",
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: 6,
	},
	adminDeclineBtn: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#EF4444",
		paddingVertical: 4,
		paddingHorizontal: 10,
		borderRadius: 6,
	},
	adminBtnText: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "600",
		marginLeft: 4,
	},
	emptyText: {
		fontSize: 14,
		color: "#9CA3AF",
		fontStyle: "italic",
		textAlign: "center",
		paddingVertical: 12,
	},
	adminModalFooter: {
		flexDirection: "row",
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: "#E5E7EB",
		gap: 12, // Add spacing between buttons
	},
	closeModalButton: {
		flex: 1,
		paddingVertical: 12,
		backgroundColor: "#6B7280",
		borderRadius: 8,
		alignItems: "center",
	},
	closeModalButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#FFFFFF",
	},
	openEventButton: {
		flex: 1,
		paddingVertical: 12,
		backgroundColor: "#4A90E2",
		borderRadius: 8,
		alignItems: "center",
	},
	openEventButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#FFFFFF",
	},
});

export default AvailabilityPage;
