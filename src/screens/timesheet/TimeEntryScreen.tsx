import React, { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { useFocusEffect } from "@react-navigation/native";
import DatePicker from "react-native-date-picker";
import TimeEntryCard from "../../components/time/TimeEntryCard";
import TimeEntrySubmitModal from "../../components/time/TimeEntrySubmitModal";
import { useTimeTracking } from "../../hooks/useTimeTracking";
import { useEntryElapsed } from "../../hooks/useEntryElapsed";
import { useLocationTracking } from "../../hooks/useLocationTracking";
import { LocationConsentSheet } from "../../components/time/LocationConsentSheet";
import { formatDuration, formatStopwatch } from "../../utils/timeUtils";
import { submitForApproval } from "../../services/timeEntryService";
import { setConnections } from "../../services/timeEntryEditService";
import { track } from "../../services/offline/pendingWrites";
import { getConnectivity } from "../../lib/connectivity";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	Icon,
	IconButton,
	Pressable,
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
 *
 * Every clock action here works offline and none of them awaits the server —
 * see the note in useTimeTracking. The confirmation toasts say so, because the
 * failure this screen used to produce was silent: the write never landed, the
 * button stayed spinning, and the worker had no idea whether their shift had
 * been recorded.
 */

/**
 * Sub-copy telling the user their action was kept locally.
 *
 * Undefined when online, so the toast stays a plain confirmation. Replaces the
 * old "Check your connection." — the action is not lost, so that read as a
 * failure when it was a success.
 */
const offlineHint = (): string | undefined =>
	getConnectivity() === "offline"
		? "Saved on this device. It'll sync when you're back online."
		: undefined;

const TimeEntryScreen = ({ navigation }) => {
	const theme = useTheme();
	const styles = useThemedStyles(clockStyles);
	const { userId, companyId } = useUser();
	const { company, preferences, timeZone } = useCompany();

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

	/*
	 * Location, reconciled AFTER the clock rather than gating it.
	 *
	 * The consent sheet appears once a shift is open, not before clock-in. That
	 * ordering is deliberate: clocking in works offline and must never wait on a
	 * permission dialog, a settings round trip, or a worker reading four
	 * paragraphs in a car park. The cost is the first few seconds of a shift
	 * going unrecorded, which is worth it — a missed clock-in is a payroll
	 * dispute, a missed minute of route is nothing.
	 *
	 * Play's prominent-disclosure requirement is still met: the sheet is shown
	 * before any OS permission prompt, which is what the rule is about.
	 */
	const {
		locationIndicator,
		needsConsent,
		acceptConsent,
		declineConsent,
		openSettings,
	} = useLocationTracking(activeTimeEntry);

	const handleAcceptConsent = async () => {
		const level = await acceptConsent();
		if (level === "always") return;

		/*
		 * Android 11+ refuses to grant background location from a dialog at all
		 * — the request comes back denied and the settings page is the only
		 * route. Said out loud, because otherwise the worker believes they
		 * agreed to something that then quietly did not happen.
		 *
		 * acceptConsent deliberately takes a few seconds to resolve a shortfall,
		 * because iOS reports one for grants it is still in the middle of
		 * making. Warning someone that their route will not record, moments
		 * before it starts recording, is worse than warning them late.
		 *
		 * The toast is the notification; the way to FIX it is the persistent
		 * row in ClockControl below, not this. A transient banner is the wrong
		 * place to put the only route to a settings page.
		 */
		toast.warning(
			"Location isn't fully on",
			level === "whileInUse"
				? "Your route will only record while AntHill is open."
				: "Location permission was declined, so this shift won't be tracked.",
		);
	};

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

	const handleClockIn = () => {
		try {
			clockIn();
			toast.success("Clocked in", offlineHint());
		} catch (error) {
			// The write itself queues locally and cannot fail for lack of a
			// network, so reaching here means something genuinely broke.
			console.error("Error clocking in:", error);
			toast.error("Could not clock in", "Please try again.");
		}
	};

	const handlePause = () => {
		try {
			pauseTimer();
		} catch (error) {
			console.error("Error pausing:", error);
			toast.error("Could not pause", "Please try again.");
		}
	};

	const handleResume = () => {
		try {
			resumeTimer();
		} catch (error) {
			console.error("Error resuming:", error);
			toast.error("Could not resume", "Please try again.");
		}
	};

	const handleClockOut = () => {
		// The submit sheet clocks out as part of submitting.
		setSelectedTimeEntry(activeTimeEntry);
		setSubmitModalVisible(true);
	};

	/*
	 * Ends the shift and submits it.
	 *
	 * NOTHING HERE IS AWAITED, deliberately. Every one of these writes lands on
	 * local disk and replays when the network returns, but their promises only
	 * settle on server acknowledgement — so awaiting them wedged the submit
	 * sheet open on any job site with no signal, which is most of them. They are
	 * handed to pendingWrites.track instead, which reports a genuine failure
	 * without blocking the worker from going home.
	 */
	const handleSubmitTimeEntry = async (timeEntryId, entry) => {
		if (!timeEntryId || !companyId) {
			throw new Error("Missing required data for submission");
		}

		try {
			// If this is the active time entry, clock out first.
			const isActiveEntry =
				activeTimeEntry && activeTimeEntry.id === timeEntryId;
			if (isActiveEntry) clockOut();

			/*
			 * Two targeted writes. v1 handed the whole enriched entry to a
			 * service that wrote it back wholesale, embedding two form schemas
			 * per submission along the way.
			 */
			track(
				"submitForApproval",
				submitForApproval(timeEntryId, {
					notes: entry.notes,
					formResponses: entry.formResponses,
					formSchemaIds: entry.formSchemaIds,
				}),
			);

			if (entry.connections?.length) {
				track(
					"setConnections",
					setConnections(companyId, timeEntryId, entry.connections),
				);
			}
		} catch (error) {
			console.error("Error submitting time entry:", error);
			throw new Error("Failed to submit");
		}

		toast.success("Sent for approval", offlineHint());
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
							onPause={handlePause}
							onResume={handleResume}
							/*
							 * One resolved value rather than two booleans
							 * derived here. The company's showRecordingIndicator
							 * switch, the consent sheet being open and every
							 * check that has not finished yet are all folded in
							 * by the hook — this screen used to combine them
							 * itself and showed the warning row during the
							 * second or two before tracking had started.
							 */
							locationIndicator={locationIndicator}
							onFixLocation={openSettings}
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

			<LocationConsentSheet
				visible={needsConsent}
				companyName={company?.name || "Your employer"}
				onAccept={handleAcceptConsent}
				onDecline={declineConsent}
				allowDeclining={preferences.locationTracking.allowDeclining}
				workersSeeOwnRoutes={
					preferences.locationTracking.workersSeeOwnRoutes
				}
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
	locationIndicator,
	onFixLocation,
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
		<Card style={styles.clockCard}>
			{/*
			 * The state edge. A child rather than a border — see stateRail.
			 */}
			<View
				style={[
					styles.stateRail,
					isPaused ? styles.stateRailPaused : styles.stateRailRunning,
				]}
				pointerEvents="none"
			/>

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

			{/*
			 * The visible half of the promise made in the consent sheet.
			 *
			 * iOS shows its blue bar and Android its foreground-service
			 * notification regardless, so this is not what makes tracking
			 * visible — it is what makes it legible, in the one place the
			 * worker is already looking, in words rather than a system glyph.
			 */}
			{locationIndicator === "recording" && (
				<View style={styles.locationRow}>
					<Icon name="navigate" size="sm" color="accent" />
					<Text variant="caption" color="textSecondary">
						Recording your location for this shift
					</Text>
				</View>
			)}

			{/*
			 * Tracking is on for the company and this worker agreed, but the OS
			 * is not letting us record. A persistent row rather than the toast
			 * that fired once at clock-in — this is the only route to the
			 * settings page, and it has to still be here an hour later.
			 *
			 * Never shown on an unfinished check: the hook holds this at "none"
			 * until permission and the tracker have both settled, so the row
			 * appears once and stays, rather than flashing at every clock-in.
			 */}
			{locationIndicator === "attention" && (
				<Pressable
					onPress={onFixLocation}
					style={styles.locationRow}
					accessibilityLabel="Open settings to allow location"
				>
					<Icon name="warning-outline" size="sm" color="warning" />
					<Text variant="caption" color="warning" style={styles.flex}>
						Location isn't being recorded. Tap to fix in Settings.
					</Text>
					<Icon name="chevron-forward" size="sm" color="warning" />
				</Pressable>
			)}
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
		/*
		 * A left edge that states the timer's state at a glance.
		 *
		 * Drawn as a clipped child, NOT as `borderLeftWidth`. A 3pt left border
		 * on a rounded card that already carries a hairline outline does not
		 * stop at the corners: RN mitres the two widths together, so the colour
		 * ran a sliver along the top and bottom edges — too thin to read as
		 * deliberate, and it only appeared while clocked in.
		 *
		 * Inset by the hairline (absolute children position against the padding
		 * box), and the card's own `overflow: "hidden"` rounds the rail's ends
		 * to the card radius.
		 */
		stateRail: {
			position: "absolute",
			left: 0,
			top: 0,
			bottom: 0,
			width: 3,
		},
		stateRailRunning: {
			backgroundColor: theme.colors.success,
		},
		stateRailPaused: {
			backgroundColor: theme.colors.warning,
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
		locationRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
			marginTop: theme.spacing.md,
			paddingTop: theme.spacing.md,
			borderTopWidth: theme.hairlineWidth,
			borderTopColor: theme.colors.border,
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
