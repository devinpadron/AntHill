import React, { useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useAvailability } from "../../hooks/useAvailability";
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
	const {
		isAdmin,
		activeTab,
		setActiveTab,
		events,
		filteredEvents,
		loading,
		respondToEvent,
		reminder,
		saveReminderSettings: persistReminderSettings,
		workerBuckets: eventWorkerDetails,
		loadingWorkers: loadingWorkerDetails,
		loadWorkerBuckets,
		setWorkerResponse,
	} = useAvailability();

	// Modal state stays here — it is presentation, not data.
	const [reminderModalVisible, setReminderModalVisible] = useState(false);
	const [reminderHours, setReminderHours] = useState("24");
	const [reminderMinutes, setReminderMinutes] = useState("0");
	const [remindersEnabled, setRemindersEnabled] = useState(true);
	const [adminModalVisible, setAdminModalVisible] = useState(false);
	const [selectedEventForAdmin, setSelectedEventForAdmin] = useState(null);

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

		const handleConfirm = () => respondToEvent(item, "confirmed");
		const handleDecline = () => respondToEvent(item, "declined");
		// Back to unanswered, from either the confirmed or declined tab.
		const handleUndecline = () => respondToEvent(item, "pending");

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
		setReminderHours(String(reminder?.hours ?? 24));
		setReminderMinutes(String(reminder?.minutes ?? 0));
		setRemindersEnabled(reminder?.enabled !== false);
		setReminderModalVisible(true);
	};

	const saveReminderSettings = async () => {
		const saved = await persistReminderSettings({
			enabled: remindersEnabled,
			hours: reminderHours,
			minutes: reminderMinutes,
		});
		if (saved) setReminderModalVisible(false);
	};

	const handleAdminStatusChange = (targetUserId, newStatus) => {
		if (!selectedEventForAdmin) return;
		return setWorkerResponse(
			selectedEventForAdmin,
			targetUserId,
			newStatus,
		);
	};

	const handleAdminEventPress = (event) => {
		setSelectedEventForAdmin(event);
		setAdminModalVisible(true);
		loadWorkerBuckets(event.id);
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
					data={filteredEvents}
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
