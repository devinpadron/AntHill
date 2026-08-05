import React, { useState, useEffect } from "react";
import {
	View,
	Text,
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
	getAvailabilityEvents,
	getEventResponses,
	getEventsInRange,
	setEventResponse,
	subscribeMyResponses,
	subscribeMyUpcomingEvents,
} from "../../services/eventService";
import { useCompanyMembers } from "../../hooks/useCompanyMembers";
import { useCompany } from "../../contexts/CompanyContext";
import { useGroups } from "../../hooks/useGroups";
import { FilterType } from "../../types";
import { styles } from "./AvailabilityPage.styles";

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
	const { userId, companyId, isAdmin, membership } = useUser();

	/*
	 * Which jobs this worker is allowed to see.
	 *
	 * "open" is the default and what every migrated membership carries: all
	 * unassigned events that were not published to a specific group, exactly as
	 * in v1. A "restricted" worker — a 1099 contractor — sees only the jobs
	 * they were invited to.
	 */
	const visibility = membership?.visibility ?? "open";

	/*
	 * Preferences come from CompanyContext, not a one-shot read.
	 *
	 * This screen was still calling the v1 companyService, which reads
	 * Companies/{c}/Settings/preferences — a path a v2-only account has no
	 * membership for, so the read is denied. The context already holds these,
	 * live, and v1 nested the reminder fields flat while v2 groups them under
	 * `availabilityReminder`.
	 */
	const { preferences, updatePreferences } = useCompany();

	// Refresh data every time the screen comes into focus
	useFocusEffect(
		React.useCallback(() => {
			fetchEventsFromFirebase();
		}, [userId, companyId]),
	);

	/*
	 * The user's own responses, one query.
	 *
	 * v1 read each event's embedded workerStatus map, so a response required
	 * loading the whole event document.
	 */
	const [myResponses, setMyResponses] = useState<Record<string, string>>({});
	const { members, namesFor: personNamesFor } = useCompanyMembers(
		companyId ?? "",
	);
	const { namesFor: groupNamesFor } = useGroups(companyId ?? "");

	/*
	 * The response ids double as the invitation list, and the focus handler
	 * fetches from a callback whose deps are only [userId, companyId] — so it
	 * would close over an empty map and show a restricted worker nothing.
	 * A ref keeps the fetch reading the current set whenever it runs.
	 */
	const myResponsesRef = React.useRef<Record<string, string>>({});

	useEffect(() => {
		if (!companyId || !userId) return;
		const today = new Date().toISOString().slice(0, 10);
		return subscribeMyResponses(companyId, userId, today, (next) => {
			myResponsesRef.current = next;
			setMyResponses(next);
		});
	}, [companyId, userId]);

	// `visibility` is in here because the membership subscription is live: a
	// manager restricting a worker takes effect on their device immediately,
	// without a relaunch.
	useEffect(() => {
		fetchEventsFromFirebase();
	}, [userId, myResponses, visibility]);

	const fetchEventsFromFirebase = async () => {
		setLoading(true);

		try {
			const today = new Date().toISOString().slice(0, 10);
			/*
			 * Open jobs plus this worker's invitations, or invitations alone if
			 * they are restricted. The invitation ids come from their own
			 * eventResponses, which the security rules already scope to them —
			 * a worker who was never invited to a targeted job has no document
			 * for it, so it cannot appear here.
			 */
			const fetchedEvents: any = await getAvailabilityEvents(
				companyId,
				today,
				visibility,
				Object.keys(myResponsesRef.current),
				Boolean(isAdmin),
			);

			// Days the user is already committed to, for the conflict badge.
			const assignedEvents: any = await getEventsInRange(companyId, {
				from: today,
				to: "2999-12-31",
				filter: FilterType.MY,
				userId,
			});

			if (fetchedEvents && fetchedEvents.length > 0) {
				// Create a set of dates where the user already has assigned events
				const assignedEventDates = new Set(
					assignedEvents?.map((event) => {
						return event.dateKey; // Use the date string directly for comparison
					}) || [],
				);

				// Transform the fetched events to match the UI requirements
				const formattedEvents = fetchedEvents.map((event) => {
					// Use the date string directly from Firebase (YYYY-MM-DD format)
					const eventDateString = event.dateKey;

					// Parse the date string correctly to avoid timezone issues
					const [year, month, day] = event.dateKey.split("-");
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

					// One lookup in the responses map. v1 read each event's
					// embedded workerStatus map.
					if (myResponses[event.id]) {
						const userStatus = myResponses[event.id];
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
						groupNames: groupNamesFor(event.audienceGroupIds ?? []),
						personNames: personNamesFor(
							event.audienceUserIds ?? [],
						),
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

	const updateEventStatus = async (eventId, confirmed, eventDateKey = "") => {
		// Firebase update will go here

		if (confirmed) {
			await setEventResponse(
				companyId,
				eventId,
				userId,
				"confirmed",
				eventDateKey,
			);
		} else {
			await setEventResponse(
				companyId,
				eventId,
				userId,
				"declined",
				eventDateKey,
			);
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
			setEventResponse(
				companyId,
				item.id,
				userId,
				"pending",
				item.rawData?.dateKey ?? "",
			);

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

							{/*
							 * Who this job went to. Only targeted jobs carry
							 * any badge, so the absence of one reads as
							 * "everyone" without needing its own label.
							 */}
							{(item.groupNames?.length > 0 ||
								item.personNames?.length > 0) && (
								<View style={styles.groupBadgeRow}>
									{item.groupNames.map((name) => (
										<View
											key={`g-${name}`}
											style={styles.groupBadge}
										>
											<Ionicons
												name="people"
												size={11}
												color="#5a3ec8"
											/>
											<Text
												style={styles.groupBadgeText}
												numberOfLines={1}
											>
												{name}
											</Text>
										</View>
									))}
									{/*
									 * Individually invited people, capped — a
									 * job sent to a dozen names should not push
									 * the date and location off the card.
									 */}
									{item.personNames
										.slice(0, 2)
										.map((name) => (
											<View
												key={`p-${name}`}
												style={styles.groupBadge}
											>
												<Ionicons
													name="person"
													size={11}
													color="#5a3ec8"
												/>
												<Text
													style={
														styles.groupBadgeText
													}
													numberOfLines={1}
												>
													{name}
												</Text>
											</View>
										))}
									{item.personNames.length > 2 && (
										<View style={styles.groupBadge}>
											<Text style={styles.groupBadgeText}>
												+{item.personNames.length - 2}
											</Text>
										</View>
									)}
								</View>
							)}
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

	const handleReminderSettings = () => {
		const reminder = preferences?.availabilityReminder;
		setReminderHours(String(reminder?.hours ?? 24));
		setReminderMinutes(String(reminder?.minutes ?? 0));
		setRemindersEnabled(reminder?.enabled !== false);
		setReminderModalVisible(true);
	};

	const saveReminderSettings = async () => {
		try {
			const hours = parseInt(reminderHours) || 24;
			const minutes = parseInt(reminderMinutes) || 0;

			await updatePreferences({
				availabilityReminder: {
					enabled: remindersEnabled,
					hours,
					minutes,
				},
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
			/*
			 * Members come from the membership query already running, and their
			 * responses from one eventResponses query. v1 fetched every user
			 * profile in the company and then re-read the event for its
			 * workerStatus map.
			 */
			const responses = await getEventResponses(companyId, event.id);

			const categorizedUsers = {
				confirmed: [],
				declined: [],
				unconfirmed: [],
			};

			members.forEach((member) => {
				const userStatus = responses[member.userId];
				const userWithStatus = {
					...member,
					id: member.userId,
					status: userStatus ?? "pending",
				};

				if (userStatus === "confirmed") {
					categorizedUsers.confirmed.push(userWithStatus);
				} else if (userStatus === "declined") {
					categorizedUsers.declined.push(userWithStatus);
				} else {
					categorizedUsers.unconfirmed.push(userWithStatus);
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
		const eventDateKey = selectedEventForAdmin.rawData?.dateKey ?? "";

		if (newStatus === "confirmed") {
			await setEventResponse(
				companyId,
				eventId,
				targetUserId,
				"confirmed",
				eventDateKey,
			);
		} else if (newStatus === "declined") {
			await setEventResponse(
				companyId,
				eventId,
				targetUserId,
				"declined",
				eventDateKey,
			);
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

export default AvailabilityPage;
