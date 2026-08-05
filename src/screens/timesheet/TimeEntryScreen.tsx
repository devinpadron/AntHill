// Time Entry Screen Component
import React, { useCallback, useMemo, useState } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	SafeAreaView,
	Alert,
	ActivityIndicator,
	RefreshControl,
	Modal,
	Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { useFocusEffect } from "@react-navigation/native";
import DatePicker from "react-native-date-picker";
import TimeEntryCard from "../../components/time/TimeEntryCard";
import TimeEntrySubmitModal from "../../components/time/TimeEntrySubmitModal";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { submitForApproval } from "../../services/timeEntryService";
import { setConnections } from "../../services/timeEntryEditService";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { styles } from "./TimeEntryScreen.styles";

// Time Entry Screen Component
const TimeEntryScreen = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const { userId, companyId } = useUser();
	const { preferences, timeZone } = useCompany();

	// Date-related states
	const [currentStartDate, setCurrentStartDate] = useState(() => {
		const weekStartsOn = preferences?.workWeekStarts === "sunday" ? 0 : 1;
		return startOfWeek(new Date(), { weekStartsOn });
	});

	const [currentEndDate, setCurrentEndDate] = useState(() => {
		const weekStartsOn = preferences?.workWeekStarts === "sunday" ? 0 : 1;
		return endOfWeek(new Date(), { weekStartsOn });
	});

	// Date picker visibility states
	const [showStartDatePicker, setShowStartDatePicker] = useState(false);
	const [showEndDatePicker, setShowEndDatePicker] = useState(false);

	// Week navigation functions
	const goToPrevWeek = () => {
		setCurrentStartDate((prev) => subWeeks(prev, 1));
		setCurrentEndDate((prev) => subWeeks(prev, 1));
	};

	const goToNextWeek = () => {
		setCurrentStartDate((prev) => addWeeks(prev, 1));
		setCurrentEndDate((prev) => addWeeks(prev, 1));
	};

	const goToCurrentWeek = () => {
		const weekStartsOn = preferences?.workWeekStarts === "sunday" ? 0 : 1;
		setCurrentStartDate(startOfWeek(new Date(), { weekStartsOn }));
		setCurrentEndDate(endOfWeek(new Date(), { weekStartsOn }));
	};

	// Date picker handlers
	const handleStartDateChange = (date) => {
		setShowStartDatePicker(false);
		if (date > currentEndDate) {
			Alert.alert(
				"Invalid Date Range",
				"Start date cannot be after end date",
			);
			return;
		}
		setCurrentStartDate(date);
	};

	const handleEndDateChange = (date) => {
		setShowEndDatePicker(false);
		if (date < currentStartDate) {
			Alert.alert(
				"Invalid Date Range",
				"End date cannot be before start date",
			);
			return;
		}
		setCurrentEndDate(date);
	};

	/*
	 * Memoized: an object literal here would be a new value every render, so
	 * the hook's effects would re-fire continuously.
	 */
	const range = useMemo(
		() => ({
			from: format(currentStartDate, "yyyy-MM-dd"),
			to: format(currentEndDate, "yyyy-MM-dd"),
		}),
		[currentStartDate, currentEndDate],
	);

	// Time tracking hook
	const {
		entries: timeEntries,
		activeEntry: activeTimeEntry,
		isLoading,
		isActive: isClockedIn,
		isPaused,
		isBusy: isPausingOrResuming,
		clockIn,
		clockOut,
		pause: pauseTimer,
		resume: resumeTimer,
		refresh: fetchTimeEntries,
		weeklyStats,
	} = useTimeTracking(companyId ?? "", userId, timeZone, range);

	// Modal and UI state
	const [refreshing, setRefreshing] = useState(false);
	const [submitModalVisible, setSubmitModalVisible] = useState(false);
	const [selectedTimeEntry, setSelectedTimeEntry] = useState(null);

	// Data fetching
	useFocusEffect(
		useCallback(() => {
			fetchTimeEntries();
			setSubmitModalVisible(false);
			return () => {
				// Optional cleanup
			};
		}, [currentStartDate, currentEndDate, fetchTimeEntries]),
	);

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

	// Time entry actions
	const handleClockOut = async () => {
		// Show submit modal immediately with active time entry
		setSelectedTimeEntry(activeTimeEntry);
		setSubmitModalVisible(true);
	};

	const handleSubmitTimeEntry = async (timeEntryId, entry) => {
		if (!timeEntryId || !companyId) {
			throw new Error("Missing required data for submission");
		}

		// If this is the active time entry, clock out first
		const isActiveEntry =
			activeTimeEntry && activeTimeEntry.id === timeEntryId;
		if (isActiveEntry) {
			try {
				await clockOut();
			} catch (error) {
				console.error("Error clocking out:", error);
				throw new Error("Failed to clock out");
			}
		}

		/*
		 * Two targeted writes. v1 handed the whole enriched entry to a service
		 * that wrote it back wholesale, embedding two form schemas per
		 * submission along the way.
		 */
		await submitForApproval(timeEntryId, {
			notes: entry.notes,
			formResponses: entry.formResponses,
			formSchemaIds: entry.formSchemaIds,
		});

		if (entry.connections?.length) {
			await setConnections(companyId, timeEntryId, entry.connections);
		}

		fetchTimeEntries();
	};

	const openSubmitModal = (timeEntry) => {
		setSelectedTimeEntry(timeEntry);
		setSubmitModalVisible(true);
	};

	const viewTimeEntryDetails = (entryId) => {
		navigation.navigate("TimeEntryDetails", { entryId, userId });
	};

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
			{/* 1. Date Range Selection */}
			<View>
				<View style={styles.dateControls}>
					<TouchableOpacity
						onPress={goToPrevWeek}
						style={styles.dateNavButton}
					>
						<Icon name="chevron-left" size={24} color="#007AFF" />
					</TouchableOpacity>

					<TouchableOpacity
						onPress={goToCurrentWeek}
						style={styles.currentWeekButton}
					>
						<Text style={styles.currentWeekText}>Current Week</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={goToNextWeek}
						style={styles.dateNavButton}
					>
						<Icon name="chevron-right" size={24} color="#007AFF" />
					</TouchableOpacity>
				</View>

				<View style={styles.dateRange}>
					<TouchableOpacity
						onPress={() => setShowStartDatePicker(true)}
						style={styles.dateButton}
					>
						<Icon
							name="calendar"
							size={18}
							color="#666"
							style={styles.calendarIcon}
						/>
						<Text style={styles.dateText}>
							{format(currentStartDate, "MMM d, yyyy")}
						</Text>
					</TouchableOpacity>

					<Text style={styles.dateRangeSeparator}>to</Text>

					<TouchableOpacity
						onPress={() => setShowEndDatePicker(true)}
						style={styles.dateButton}
					>
						<Icon
							name="calendar"
							size={18}
							color="#666"
							style={styles.calendarIcon}
						/>
						<Text style={styles.dateText}>
							{format(currentEndDate, "MMM d, yyyy")}
						</Text>
					</TouchableOpacity>
				</View>
			</View>

			{/* 2. Date Range Summary */}
			<View style={styles.summaryCard}>
				<Text style={styles.summaryTitle}>Summary</Text>
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
			</View>

			{/* 3. Clock In/Out Section */}
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
									activeTimeEntry.clockInAt.toDate(),
									"h:mm a",
								)}
							</Text>
						</View>

						<View style={styles.buttonRow}>
							{isPausingOrResuming ? (
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

			{/* 4. Time Entries List */}
			<View style={styles.entriesSection}>
				<TouchableOpacity
					style={styles.sectionTitleButton}
					onPress={() =>
						navigation.navigate("TimeEntryDetails", {
							entryId: timeEntries.map((e) => e.id),
							userId,
						})
					}
				>
					<Text style={styles.sectionTitle}>Time Entries</Text>
					<Icon name="chevron-right" size={20} color="#007AFF" />
				</TouchableOpacity>
				<FlatList
					data={timeEntries}
					keyExtractor={(item) => item.id}
					renderItem={renderTimeEntry}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>
								No time entries found for this week
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

			{/* 5. Time Entry Submission Modal */}
			<TimeEntrySubmitModal
				visible={submitModalVisible}
				timeEntry={selectedTimeEntry}
				onClose={() => setSubmitModalVisible(false)}
				onSubmit={handleSubmitTimeEntry}
			/>

			{/* Date Pickers */}
			<DatePicker
				modal
				mode="date"
				open={showStartDatePicker}
				date={currentStartDate}
				onConfirm={handleStartDateChange}
				onCancel={() => setShowStartDatePicker(false)}
			/>

			<DatePicker
				modal
				mode="date"
				open={showEndDatePicker}
				date={currentEndDate}
				onConfirm={handleEndDateChange}
				onCancel={() => setShowEndDatePicker(false)}
			/>
		</SafeAreaView>
	);
};

// Add these new styles to your existing StyleSheet

export default TimeEntryScreen;
