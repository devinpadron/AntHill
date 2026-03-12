// Time Entry Screen Component
import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import DatePicker from "react-native-date-picker";
import { Container, Spacer } from "../../components/ui";
import {
	DateRangeSelector,
	WeeklySummary,
	ClockSection,
	TimeEntriesList,
	TimeEntrySubmitModal,
} from "../../components/time";
import { useDateRange } from "../../hooks/timesheet/useDateRange";
import { useTimeEntries } from "../../hooks/timesheet/useTimeEntries";
import { useActiveTimeEntry } from "../../hooks/timesheet/useActiveTimeEntry";
import { useClockActions } from "../../hooks/timesheet/useClockActions";
import { useWeeklySummary } from "../../hooks/timesheet/useWeeklySummary";
import { submitTimeEntryForApproval } from "../../services/timeEntryService";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { TimeEntry } from "../../types";

/**
 * TimeEntryScreen - Main screen for time tracking and time entry management
 *
 * Features:
 * - Week/date range selection
 * - Weekly summary statistics
 * - Clock in/out controls with pause/resume
 * - Time entries list with submission
 */
const TimeEntryScreen = ({ navigation }) => {
	const { userId, companyId } = useUser();
	const { preferences } = useCompany();

	// Date range management
	const dateRange = useDateRange({
		workWeekStarts: preferences?.workWeekStarts,
	});

	// Time tracking data and actions
	const { timeEntries, isLoading, refetch } = useTimeEntries({
		startDate: dateRange.currentStartDate,
		endDate: dateRange.currentEndDate,
	});

	const { activeTimeEntry, isClockedIn, isPaused } = useActiveTimeEntry();

	const { isPausingOrResuming, clockIn, clockOut, pauseTimer, resumeTimer } =
		useClockActions();

	const weeklyStats = useWeeklySummary({
		timeEntries,
		startDate: dateRange.currentStartDate,
		endDate: dateRange.currentEndDate,
	});

	// UI state
	const [refreshing, setRefreshing] = useState(false);
	const [submitModalVisible, setSubmitModalVisible] = useState(false);
	const [selectedTimeEntry, setSelectedTimeEntry] =
		useState<TimeEntry | null>(null);

	// Refresh data when screen is focused
	useFocusEffect(
		useCallback(() => {
			refetch();
			setSubmitModalVisible(false);
		}, [dateRange.currentStartDate, dateRange.currentEndDate, refetch]),
	);

	// Pull-to-refresh handler
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refetch();
		} catch (error) {
			console.error("Error refreshing time entries:", error);
		} finally {
			setRefreshing(false);
		}
	};

	// Clock out handler - opens submit modal
	const handleClockOut = async () => {
		setSelectedTimeEntry(activeTimeEntry);
		setSubmitModalVisible(true);
	};

	// Submit time entry for approval
	const handleSubmitTimeEntry = async (
		timeEntryId: string,
		entry: TimeEntry,
	) => {
		if (!timeEntryId || !companyId) {
			throw new Error("Missing required data for submission");
		}

		// If this is the active time entry, clock out first
		const isActiveEntry =
			activeTimeEntry && activeTimeEntry.id === timeEntryId;
		if (isActiveEntry) {
			try {
				await clockOut(activeTimeEntry.id);
			} catch (error) {
				console.error("Error clocking out:", error);
				throw new Error("Failed to clock out");
			}
		}

		await submitTimeEntryForApproval(timeEntryId, companyId, entry);
		refetch();
	};

	// Open submit modal for a time entry
	const openSubmitModal = (timeEntry: TimeEntry) => {
		setSelectedTimeEntry(timeEntry);
		setSubmitModalVisible(true);
	};

	// Navigate to time entry details
	const viewTimeEntryDetails = (entryId: string) => {
		navigation.navigate("TimeEntryDetails", { entryId, userId });
	};

	// Navigate to view all time entries
	const viewAllTimeEntries = () => {
		navigation.navigate("TimeEntryDetails", {
			entryId: timeEntries.map((e) => e.id),
			userId,
		});
	};

	return (
		<Container variant="page" includeSafeArea>
			<DateRangeSelector
				currentStartDate={dateRange.currentStartDate}
				currentEndDate={dateRange.currentEndDate}
				onPrevWeek={dateRange.goToPrevWeek}
				onNextWeek={dateRange.goToNextWeek}
				onCurrentWeek={dateRange.goToCurrentWeek}
				onStartDatePress={() => dateRange.setShowStartDatePicker(true)}
				onEndDatePress={() => dateRange.setShowEndDatePicker(true)}
			/>

			<Spacer size="sm" />

			<WeeklySummary weeklyStats={weeklyStats} />

			<Spacer size="sm" />

			<ClockSection
				activeTimeEntry={activeTimeEntry}
				isPaused={isPaused}
				isPausingOrResuming={isPausingOrResuming}
				onClockIn={clockIn}
				onClockOut={handleClockOut}
				onPause={() =>
					activeTimeEntry && pauseTimer(activeTimeEntry.id)
				}
				onResume={() =>
					activeTimeEntry && resumeTimer(activeTimeEntry.id)
				}
			/>

			<Spacer size="sm" />

			<TimeEntriesList
				timeEntries={timeEntries}
				refreshing={refreshing}
				onRefresh={onRefresh}
				onViewDetails={viewTimeEntryDetails}
				onSelectEntry={openSubmitModal}
				showViewAllButton={true}
				onViewAllPress={viewAllTimeEntries}
			/>

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
				open={dateRange.showStartDatePicker}
				date={dateRange.currentStartDate}
				onConfirm={dateRange.handleStartDateChange}
				onCancel={() => dateRange.setShowStartDatePicker(false)}
			/>

			<DatePicker
				modal
				mode="date"
				open={dateRange.showEndDatePicker}
				date={dateRange.currentEndDate}
				onConfirm={dateRange.handleEndDateChange}
				onCancel={() => dateRange.setShowEndDatePicker(false)}
			/>
		</Container>
	);
};

export default TimeEntryScreen;
