import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { useFocusEffect } from "@react-navigation/native";
import DatePicker from "react-native-date-picker";
import TimeEntryCard from "../../components/time/TimeEntryCard";
import TimeEntrySubmitModal from "../../components/time/TimeEntrySubmitModal";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { useEntryElapsed } from "../../hooks/useEntryElapsed";
import { formatDuration, formatStopwatch } from "../../utils/timeUtils";
import { submitForApproval } from "../../services/timeEntryService";
import { setConnections } from "../../services/timeEntryEditService";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	Icon,
	IconButton,
	Screen,
	ScreenHeader,
	Text,
	toast,
} from "../../components/ui";
import { Theme, useTheme, useThemedStyles } from "../../theme";

/*
 * The clock.
 *
 * The clock control is the anchor of the screen rather than one of five equal
 * sections — it is the only thing most workers open this tab to do.
 *
 * The safe area is handled once, by `Screen`. This screen previously wrapped
 * itself in RN's `SafeAreaView` AND applied `paddingTop: insets.top`, so the
 * top inset was counted twice on iOS.
 */

const TimeEntryScreen = ({ navigation }) => {
	const theme = useTheme();
	const styles = useThemedStyles(clockStyles);
	const { userId, companyId } = useUser();
	const { preferences, timeZone } = useCompany();

	const weekStartsOn = preferences?.workWeekStarts === "sunday" ? 0 : 1;

	const [currentStartDate, setCurrentStartDate] = useState(() =>
		startOfWeek(new Date(), { weekStartsOn }),
	);
	const [currentEndDate, setCurrentEndDate] = useState(() =>
		endOfWeek(new Date(), { weekStartsOn }),
	);

	const [showStartDatePicker, setShowStartDatePicker] = useState(false);
	const [showEndDatePicker, setShowEndDatePicker] = useState(false);

	const goToPrevWeek = () => {
		setCurrentStartDate((prev) => subWeeks(prev, 1));
		setCurrentEndDate((prev) => subWeeks(prev, 1));
	};

	const goToNextWeek = () => {
		setCurrentStartDate((prev) => addWeeks(prev, 1));
		setCurrentEndDate((prev) => addWeeks(prev, 1));
	};

	const goToCurrentWeek = () => {
		setCurrentStartDate(startOfWeek(new Date(), { weekStartsOn }));
		setCurrentEndDate(endOfWeek(new Date(), { weekStartsOn }));
	};

	const handleStartDateChange = (date: Date) => {
		setShowStartDatePicker(false);
		if (date > currentEndDate) {
			toast.warning(
				"That range is backwards",
				"The start date cannot be after the end date.",
			);
			return;
		}
		setCurrentStartDate(date);
	};

	const handleEndDateChange = (date: Date) => {
		setShowEndDatePicker(false);
		if (date < currentStartDate) {
			toast.warning(
				"That range is backwards",
				"The end date cannot be before the start date.",
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

	const {
		entries: timeEntries,
		activeEntry: activeTimeEntry,
		isLoading,
		isPaused,
		isBusy: isPausingOrResuming,
		clockIn,
		clockOut,
		pause: pauseTimer,
		resume: resumeTimer,
		refresh: fetchTimeEntries,
		weeklyStats,
	} = useTimeTracking(companyId ?? "", userId, timeZone, range);

	const [refreshing, setRefreshing] = useState(false);
	const [submitModalVisible, setSubmitModalVisible] = useState(false);
	const [selectedTimeEntry, setSelectedTimeEntry] = useState(null);

	useFocusEffect(
		useCallback(() => {
			fetchTimeEntries();
			setSubmitModalVisible(false);
		}, [currentStartDate, currentEndDate, fetchTimeEntries]),
	);

	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await fetchTimeEntries();
		} catch (error) {
			console.error("Error refreshing time entries:", error);
			toast.error("Could not refresh", "Check your connection.");
		} finally {
			setRefreshing(false);
		}
	};

	const handleClockIn = async () => {
		await clockIn();
		toast.success("Clocked in");
	};

	const handleClockOut = () => {
		// The submit sheet clocks out as part of submitting.
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

		toast.success("Sent for approval");
		fetchTimeEntries();
	};

	const isThisWeek =
		format(currentStartDate, "yyyy-MM-dd") ===
		format(startOfWeek(new Date(), { weekStartsOn }), "yyyy-MM-dd");

	const pickerTheme = theme.isDark ? "dark" : "light";

	return (
		<Screen
			header={
				<ScreenHeader
					variant="large"
					title="Clock"
					subtitle={`${format(currentStartDate, "MMM d")} – ${format(
						currentEndDate,
						"MMM d, yyyy",
					)}`}
				>
					<View style={styles.weekBar}>
						<IconButton
							name="chevron-back"
							onPress={goToPrevWeek}
							label="Previous week"
							size="sm"
							variant="soft"
						/>

						<View style={styles.weekDates}>
							<Button
								title={format(currentStartDate, "MMM d")}
								variant="text"
								size="small"
								onPress={() => setShowStartDatePicker(true)}
							/>
							<Text variant="caption" color="textTertiary">
								to
							</Text>
							<Button
								title={format(currentEndDate, "MMM d")}
								variant="text"
								size="small"
								onPress={() => setShowEndDatePicker(true)}
							/>
						</View>

						<IconButton
							name="chevron-forward"
							onPress={goToNextWeek}
							label="Next week"
							size="sm"
							variant="soft"
						/>
					</View>

					{!isThisWeek && (
						<View style={styles.jumpBack}>
							<Button
								title="Back to this week"
								icon="today-outline"
								variant="secondary"
								size="small"
								onPress={goToCurrentWeek}
							/>
						</View>
					)}
				</ScreenHeader>
			}
		>
			<FlatList
				data={timeEntries}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<TimeEntryCard
						timeEntry={item}
						onPress={() =>
							navigation.navigate("TimeEntryDetails", {
								entryId: item.id,
								userId,
							})
						}
						onSubmit={
							item.status === "pending_approval"
								? null
								: (entry) => {
										setSelectedTimeEntry(entry);
										setSubmitModalVisible(true);
									}
						}
					/>
				)}
				contentContainerStyle={styles.list}
				showsVerticalScrollIndicator={false}
				ListHeaderComponent={
					<>
						{/* The clock. The reason this tab exists. */}
						<ClockControl
							activeEntry={activeTimeEntry}
							isPaused={isPaused}
							isBusy={isPausingOrResuming}
							onClockIn={handleClockIn}
							onClockOut={handleClockOut}
							onPause={pauseTimer}
							onResume={resumeTimer}
						/>

						<Card style={styles.summary}>
							<View style={styles.summaryRow}>
								<View style={styles.stat}>
									<Text variant="title">
										{weeklyStats.hours}h{" "}
										{weeklyStats.minutes}m
									</Text>
									<Text
										variant="caption"
										color="textSecondary"
										uppercase
									>
										Total
									</Text>
								</View>

								<View style={styles.statDivider} />

								<View style={styles.stat}>
									<Text variant="title">
										{weeklyStats.count}
									</Text>
									<Text
										variant="caption"
										color="textSecondary"
										uppercase
									>
										Shifts
									</Text>
								</View>
							</View>
						</Card>

						{timeEntries.length > 0 && (
							<View style={styles.listHeading}>
								<Text
									variant="label"
									color="textSecondary"
									uppercase
								>
									This period
								</Text>
								<Button
									title="View all"
									icon="chevron-forward"
									iconPosition="right"
									variant="text"
									size="small"
									onPress={() =>
										navigation.navigate(
											"TimeEntryDetails",
											{
												entryId: timeEntries.map(
													(e) => e.id,
												),
												userId,
											},
										)
									}
								/>
							</View>
						)}
					</>
				}
				ListEmptyComponent={
					isLoading ? null : (
						<EmptyState
							icon="time-outline"
							title="No shifts this period"
							description="Clock in above to start one, or pick a different week."
							compact
						/>
					)
				}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={theme.colors.accent}
						titleColor={theme.colors.textSecondary}
					/>
				}
			/>

			<TimeEntrySubmitModal
				visible={submitModalVisible}
				timeEntry={selectedTimeEntry}
				onClose={() => setSubmitModalVisible(false)}
				onSubmit={handleSubmitTimeEntry}
			/>

			<DatePicker
				modal
				mode="date"
				theme={pickerTheme}
				open={showStartDatePicker}
				date={currentStartDate}
				onConfirm={handleStartDateChange}
				onCancel={() => setShowStartDatePicker(false)}
			/>

			<DatePicker
				modal
				mode="date"
				theme={pickerTheme}
				open={showEndDatePicker}
				date={currentEndDate}
				onConfirm={handleEndDateChange}
				onCancel={() => setShowEndDatePicker(false)}
			/>
		</Screen>
	);
};

/**
 * The clock in / out control.
 *
 * One card whose whole appearance follows the timer's state, rather than the
 * previous three-way branch of differently-styled `TouchableOpacity` rows. The
 * paused color is one `warning` token — the old version used `#ff9500` and
 * `#FFA500` for the same state two lines apart.
 */
const ClockControl = ({
	activeEntry,
	isPaused,
	isBusy,
	onClockIn,
	onClockOut,
	onPause,
	onResume,
}) => {
	const styles = useThemedStyles(clockStyles);
	const elapsed = useEntryElapsed(activeEntry);

	if (!activeEntry) {
		return (
			<Card style={styles.clockCard}>
				<View style={styles.clockStatus}>
					<Icon name="time-outline" size="lg" color="textTertiary" />
					<Text variant="heading" color="textSecondary">
						Not clocked in
					</Text>
				</View>

				<Button
					title="Clock in"
					icon="play"
					onPress={onClockIn}
					size="large"
					fullWidth
					haptic="success"
				/>
			</Card>
		);
	}

	return (
		<Card
			style={[
				styles.clockCard,
				isPaused ? styles.clockPaused : styles.clockRunning,
			]}
		>
			<View style={styles.clockStatus}>
				<Icon
					name={isPaused ? "pause-circle" : "ellipse"}
					size="lg"
					color={isPaused ? "warning" : "success"}
				/>
				<View style={styles.flex}>
					<Text variant="heading">
						{isPaused ? "Paused" : "On the clock"}
					</Text>
					<Text variant="caption" color="textSecondary">
						Since {format(activeEntry.clockInAt.toDate(), "h:mm a")}
					</Text>
				</View>
				<Badge
					label={isPaused ? "Paused" : "Running"}
					tone={isPaused ? "warning" : "success"}
					dot
				/>
			</View>

			{/*
			 * The running total, the reason most people open this tab.
			 *
			 * It stops moving while paused — the number is paid time, not time
			 * since clock-in — so the pause total sits underneath to explain
			 * why it is holding still.
			 */}
			<View style={styles.timerBlock}>
				<Text
					variant="display"
					color={isPaused ? "textSecondary" : "text"}
					style={styles.timer}
					accessibilityLabel={`Clocked in for ${formatDuration(
						elapsed.workedSeconds,
					)}`}
				>
					{formatStopwatch(elapsed.workedSeconds)}
				</Text>

				{elapsed.pausedSeconds > 0 && (
					<Text variant="caption" color="warning">
						{formatStopwatch(elapsed.pausedSeconds)} paused
					</Text>
				)}
			</View>

			<View style={styles.clockActions}>
				<Button
					title={isPaused ? "Resume" : "Pause"}
					icon={isPaused ? "play" : "pause"}
					variant="secondary"
					onPress={isPaused ? onResume : onPause}
					loading={isBusy}
					disabled={isBusy}
					style={styles.flex}
				/>
				<Button
					title="Clock out"
					icon="stop"
					onPress={onClockOut}
					disabled={isBusy}
					haptic="press"
					style={styles.flex}
				/>
			</View>
		</Card>
	);
};

export default TimeEntryScreen;

const clockStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		weekBar: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: theme.spacing.lg,
			paddingBottom: theme.spacing.sm,
		},
		weekDates: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.xs,
		},
		jumpBack: {
			flexDirection: "row",
			justifyContent: "center",
			paddingBottom: theme.spacing.md,
		},
		list: {
			flexGrow: 1,
			padding: theme.spacing.lg,
			paddingBottom: theme.spacing["3xl"],
		},
		clockCard: {
			gap: theme.spacing.lg,
		},
		timerBlock: {
			alignItems: "center",
			gap: theme.spacing.xs,
		},
		timer: {
			/*
			 * Tabular figures, so the digits do not jiggle the layout as they
			 * change once a second.
			 */
			fontVariant: ["tabular-nums"],
			fontSize: 44,
			lineHeight: 50,
			letterSpacing: -1,
		},
		/* A left edge that states the timer's state at a glance. */
		clockRunning: {
			borderLeftWidth: 3,
			borderLeftColor: theme.colors.success,
		},
		clockPaused: {
			borderLeftWidth: 3,
			borderLeftColor: theme.colors.warning,
		},
		clockStatus: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
		},
		clockActions: {
			flexDirection: "row",
			gap: theme.spacing.sm,
		},
		summary: {
			marginTop: theme.spacing.lg,
		},
		summaryRow: {
			flexDirection: "row",
			alignItems: "center",
		},
		stat: {
			flex: 1,
			alignItems: "center",
			gap: 2,
		},
		statDivider: {
			width: theme.hairlineWidth,
			alignSelf: "stretch",
			backgroundColor: theme.colors.border,
		},
		listHeading: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginTop: theme.spacing.xl,
			marginBottom: theme.spacing.sm,
		},
	});
