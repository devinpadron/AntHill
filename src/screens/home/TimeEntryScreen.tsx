// Time Entry Screen Component
import React, { useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	FlatList,
	SafeAreaView,
	Alert,
	ActivityIndicator,
	RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format, startOfWeek, endOfWeek, differenceInMinutes } from "date-fns";
import TimeEntryCard from "../../components/time/TimeEntryCard";
import TimeEntrySubmitModal from "../../components/time/TimeEntrySubmitModal";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { submitTimeEntryForApproval } from "../../services/timeEntryService";
import { useUser } from "../../contexts/UserContext";

// Time Entry Screen Component
const TimeEntryScreen = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const { userId, companyId } = useUser();
	const {
		timeEntries,
		activeTimeEntry,
		isLoading,
		isClockedIn,
		isPaused,
		isPausingOrResuming,
		clockIn,
		clockOut,
		pauseTimer,
		resumeTimer,
		weeklyStats,
		fetchTimeEntries,
	} = useTimeTracking();

	// Add state for pull-to-refresh
	const [refreshing, setRefreshing] = useState(false);

	// Add state for time entry submission modal
	const [submitModalVisible, setSubmitModalVisible] = useState(false);
	const [selectedTimeEntry, setSelectedTimeEntry] = useState(null);

	// Handle pull-to-refresh
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await fetchTimeEntries();
		} catch (error) {
			console.error("Error refreshing time entries:", error);
		} finally {
			setRefreshing(false);
		}
	};

	// Weekly summary data
	const today = new Date();
	const weekStart = startOfWeek(today, { weekStartsOn: 0 });
	const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

	// Handle clock out with confirmation
	const handleClockOut = async () => {
		Alert.alert("Clock Out", "Are you sure you want to clock out?", [
			{
				text: "Cancel",
				style: "cancel",
			},
			{
				text: "Clock Out",
				style: "destructive",
				onPress: async () => {
					try {
						const completedEntry = await clockOut();
						fetchTimeEntries();

						// Show submit for approval option after clock out
						setTimeout(() => {
							setSelectedTimeEntry(completedEntry);
							setSubmitModalVisible(true);
						}, 500);
					} catch (error) {
						console.error("Error clocking out:", error);
						Alert.alert("Error", "Failed to clock out");
					}
				},
			},
		]);
	};

	// Handle time entry submission
	const handleSubmitTimeEntry = async (timeEntryId, entry) => {
		if (!timeEntryId || !companyId) {
			throw new Error("Missing required data for submission");
		}

		await submitTimeEntryForApproval(timeEntryId, companyId, entry);
		fetchTimeEntries(); // Refresh the list to update status
	};

	// Open submit modal for a specific time entry
	const openSubmitModal = (timeEntry) => {
		setSelectedTimeEntry(timeEntry);
		setSubmitModalVisible(true);
	};

	// View time entry details
	const viewTimeEntryDetails = (entryId) => {
		// Future implementation
	};

	// Update the renderTimeEntry function
	const renderTimeEntry = ({ item }) => {
		return (
			<TimeEntryCard
				timeEntry={item}
				onPress={() => viewTimeEntryDetails(item.id)}
				onSubmit={
					item.status === "pending_approval" ? null : openSubmitModal
				}
			/>
		);
	};

	return (
		<SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
			{/* Weekly Summary */}
			<View style={styles.summaryCard}>
				<Text style={styles.summaryTitle}>This Week</Text>
				<View style={styles.summaryStats}>
					<View style={styles.statItem}>
						<Text style={styles.statValue}>
							{weeklyStats.hours}h {weeklyStats.minutes}m
							{weeklyStats.seconds > 0 &&
								` ${weeklyStats.seconds}s`}
						</Text>
						<Text style={styles.statLabel}>Total Hours</Text>
					</View>
					<View style={styles.divider} />
					<View style={styles.statItem}>
						<Text style={styles.statValue}>
							{weeklyStats.count}
						</Text>
						<Text style={styles.statLabel}>Shifts</Text>
					</View>
				</View>
				<Text style={styles.weekRange}>
					{format(weekStart, "MMM d")} -{" "}
					{format(weekEnd, "MMM d, yyyy")}
				</Text>
			</View>

			{/* Clock In/Out Section */}
			<View style={styles.clockSection}>
				{activeTimeEntry ? (
					<>
						<View style={styles.activeClockStatus}>
							<Icon
								name={
									isPaused ? "pause-circle" : "clock-outline"
								}
								size={24}
								color={isPaused ? "#FFA500" : "#ff9500"}
								style={styles.clockIcon}
							/>
							<Text
								style={[
									styles.clockedInText,
									isPaused && styles.pausedText,
								]}
							>
								{isPaused ? "Timer paused" : "Clocked in at"}{" "}
								{format(
									new Date(activeTimeEntry.clockInTime),
									"h:mm a",
								)}
							</Text>
						</View>

						{/* Action buttons */}
						<View style={styles.buttonRow}>
							{isPausingOrResuming ? (
								// Show loading button
								<TouchableOpacity
									style={[
										styles.clockButton,
										styles.loadingButton,
									]}
									disabled={true}
								>
									<ActivityIndicator
										size="small"
										color="white"
										style={styles.buttonIcon}
									/>
									<Text style={styles.clockButtonText}>
										{isPaused
											? "RESUMING..."
											: "PAUSING..."}
									</Text>
								</TouchableOpacity>
							) : isPaused ? (
								// Resume button
								<TouchableOpacity
									style={[
										styles.clockButton,
										styles.resumeButton,
									]}
									onPress={resumeTimer}
								>
									<Icon
										name="play"
										size={18}
										color="white"
										style={styles.buttonIcon}
									/>
									<Text style={styles.clockButtonText}>
										RESUME
									</Text>
								</TouchableOpacity>
							) : (
								// Pause button
								<TouchableOpacity
									style={[
										styles.clockButton,
										styles.pauseButton,
									]}
									onPress={pauseTimer}
								>
									<Icon
										name="pause"
										size={18}
										color="white"
										style={styles.buttonIcon}
									/>
									<Text style={styles.clockButtonText}>
										PAUSE
									</Text>
								</TouchableOpacity>
							)}

							<TouchableOpacity
								style={[
									styles.clockButton,
									styles.clockOutButton,
								]}
								onPress={handleClockOut}
								disabled={isPausingOrResuming}
							>
								<Icon
									name="logout-variant"
									size={18}
									color="white"
									style={styles.buttonIcon}
								/>
								<Text style={styles.clockButtonText}>
									CLOCK OUT
								</Text>
							</TouchableOpacity>
						</View>
					</>
				) : (
					<>
						<View style={styles.notClockedIn}>
							<Icon
								name="clock-outline"
								size={24}
								color="#999"
								style={styles.clockIcon}
							/>
							<Text style={styles.notClockedInText}>
								Not clocked in
							</Text>
						</View>
						<TouchableOpacity
							style={[styles.clockButton, styles.clockInButton]}
							onPress={clockIn}
						>
							<Icon
								name="login-variant"
								size={18}
								color="white"
								style={styles.buttonIcon}
							/>
							<Text style={styles.clockButtonText}>CLOCK IN</Text>
						</TouchableOpacity>
					</>
				)}
			</View>

			{/* Recent Time Entries */}
			<View style={styles.entriesSection}>
				<Text style={styles.sectionTitle}>Recent Time Entries</Text>
				<FlatList
					data={timeEntries}
					keyExtractor={(item) => item.id}
					renderItem={renderTimeEntry}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>
								No time entries found
							</Text>
						</View>
					}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							colors={["#007AFF"]}
							tintColor="#007AFF"
							title="Refreshing..."
							titleColor="#999"
						/>
					}
				/>
			</View>

			{/* Time Entry Submission Modal */}
			<TimeEntrySubmitModal
				visible={submitModalVisible}
				timeEntry={selectedTimeEntry}
				onClose={() => setSubmitModalVisible(false)}
				onSubmit={handleSubmitTimeEntry}
			/>
		</SafeAreaView>
	);
};

// Add these new styles to your existing StyleSheet
const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f7f7f7",
	},
	centered: {
		justifyContent: "center",
		alignItems: "center",
	},
	header: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: "#666",
	},
	summaryCard: {
		margin: 16,
		padding: 16,
		backgroundColor: "white",
		borderRadius: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	summaryTitle: {
		fontSize: 16,
		fontWeight: "500",
		marginBottom: 12,
		color: "#333",
	},
	summaryStats: {
		flexDirection: "row",
		justifyContent: "space-around",
		marginBottom: 12,
	},
	statItem: {
		alignItems: "center",
		flex: 1,
	},
	statValue: {
		fontSize: 18,
		fontWeight: "700",
		color: "#007AFF",
		marginBottom: 4,
	},
	statLabel: {
		fontSize: 12,
		color: "#666",
	},
	divider: {
		width: 1,
		backgroundColor: "#eaeaea",
		marginHorizontal: 12,
	},
	weekRange: {
		fontSize: 12,
		color: "#999",
		textAlign: "center",
	},
	clockSection: {
		margin: 16,
		padding: 16,
		backgroundColor: "white",
		borderRadius: 10,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	activeClockStatus: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 16,
	},
	notClockedIn: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 16,
	},
	clockIcon: {
		marginRight: 8,
	},
	clockedInText: {
		fontSize: 16,
		color: "#ff9500",
		fontWeight: "500",
	},
	notClockedInText: {
		fontSize: 16,
		color: "#999",
	},
	clockButton: {
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 8,
		width: "100%",
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "center",
	},
	clockInButton: {
		backgroundColor: "#34C759",
		flexDirection: "row",
		justifyContent: "center",
	},
	clockOutButton: {
		backgroundColor: "#ff3b30",
		flexDirection: "row",
		justifyContent: "center",
	},
	clockButtonText: {
		color: "white",
		fontWeight: "600",
		fontSize: 16,
	},
	entriesSection: {
		flex: 1,
		padding: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "500",
		marginBottom: 12,
		color: "#333",
	},
	emptyContainer: {
		padding: 20,
		alignItems: "center",
	},
	emptyText: {
		fontSize: 16,
		color: "#999",
	},
	buttonRow: {
		flexDirection: "column",
		justifyContent: "space-between",
		width: "100%",
		gap: 10,
	},
	pauseButton: {
		backgroundColor: "#FFA500",
		flexDirection: "row",
		justifyContent: "center",
	},
	resumeButton: {
		backgroundColor: "#34C759",
		flexDirection: "row",
		justifyContent: "center",
	},
	loadingButton: {
		backgroundColor: "#999",
		flexDirection: "row",
		justifyContent: "center",
	},
	buttonIcon: {
		marginRight: 8,
	},
	pausedText: {
		color: "#FFA500",
	},
	submitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 8,
		marginTop: -8,
		marginBottom: 12,
		backgroundColor: "#f0f7ff",
		borderRadius: 8,
		marginHorizontal: 16,
	},
	submitIcon: {
		marginRight: 6,
	},
	submitText: {
		color: "#007AFF",
		fontWeight: "500",
		fontSize: 14,
	},
	pendingApprovalBadge: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 8,
		marginTop: -8,
		marginBottom: 12,
		backgroundColor: "#fff8e1",
		borderRadius: 8,
		marginHorizontal: 16,
	},
	pendingIcon: {
		marginRight: 6,
	},
	pendingText: {
		color: "#FFA500",
		fontWeight: "500",
		fontSize: 14,
	},
});

export default TimeEntryScreen;
