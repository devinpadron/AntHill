import React, {
	useState,
	useEffect,
	useMemo,
	useCallback,
	useRef,
} from "react";
import {
	View,
	Text,
	FlatList,
	SafeAreaView,
	ActivityIndicator,
	NativeScrollEvent,
	NativeSyntheticEvent,
	ScrollView,
	RefreshControl,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import {
	format,
	startOfWeek,
	endOfWeek,
	addWeeks,
	subWeeks,
	parseISO,
} from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useUser } from "../../../contexts/UserContext";
import { subscribeTimeEntries } from "../../../services/timeEntryService";
import { useCompanyMembers } from "../../../hooks/useCompanyMembers";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import { useCompany } from "../../../contexts/CompanyContext";
import { TimeEntry } from "../../../types";
import { payrollStyles } from "./PayrollReview.styles";
import { useTheme, useThemedStyles } from "../../../theme";

const PayrollReview = ({ navigation }) => {
	const theme = useTheme();
	/* react-native-date-picker defaults to "auto", which follows the SYSTEM
	   scheme — so a user who forces dark in-app got a light picker. */
	const pickerTheme = theme.isDark ? "dark" : "light";
	const styles = useThemedStyles(payrollStyles);
	// UI state
	const [isLoading, setIsLoading] = useState(true);
	const [timeEntries, setTimeEntries] = useState([]);
	const [expandedEmployees, setExpandedEmployees] = useState({});
	const [showStartDatePicker, setShowStartDatePicker] = useState(false);
	const [showEndDatePicker, setShowEndDatePicker] = useState(false);

	// User context
	const { userId, companyId } = useUser();
	const { preferences } = useCompany();

	// State for date range

	const [startDate, setStartDate] = useState(() => {
		// Use company preference for week start day if available, otherwise default to Sunday (0)
		const weekStartsOn = preferences?.workWeekStarts == "sunday" ? 0 : 1;
		return startOfWeek(new Date(), { weekStartsOn });
	});
	const [endDate, setEndDate] = useState(() => {
		const weekStartsOn = preferences?.workWeekStarts == "sunday" ? 0 : 1;
		return endOfWeek(new Date(), { weekStartsOn });
	});

	// Names come off the membership records, in one query.
	const { byUserId: membersById } = useCompanyMembers(companyId ?? "");

	/*
	 * Where the reviewer had scrolled to.
	 *
	 * Payroll review is a walk DOWN the list: open someone, approve, come back,
	 * open the next one. The list was landing back at the top after every
	 * round trip, so each approval cost a re-scroll past everyone already done,
	 * and it got worse the further down the list you were.
	 *
	 * Two things reset it, and both are handled here. The list used to be
	 * swapped out for a spinner whenever the subscription was rebuilt (see the
	 * effect below), which remounts the ScrollView at zero — `pendingRestore`
	 * re-applies the offset once the rows are back and tall enough to hold it.
	 * Separately, a native-stack screen can come back from a push with its
	 * scroll position cleared, which no content-size change announces, so the
	 * offset is re-applied on focus as well.
	 *
	 * Refs, not state: this updates on every frame of a scroll.
	 */
	const scrollRef = useRef<ScrollView>(null);
	const scrollOffset = useRef(0);
	const pendingRestore = useRef<number | null>(null);

	const handleScroll = useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>) => {
			scrollOffset.current = event.nativeEvent.contentOffset.y;
			/* The reviewer has taken over; a queued restore is now stale. */
			pendingRestore.current = null;
		},
		[],
	);

	const restoreScroll = useCallback((target: number) => {
		if (target <= 0) return;
		/* A frame late, so the rows are laid out and the offset is reachable. */
		requestAnimationFrame(() =>
			scrollRef.current?.scrollTo({ y: target, animated: false }),
		);
	}, []);

	const handleContentSizeChange = useCallback(
		(_width: number, height: number) => {
			const target = pendingRestore.current;
			if (target === null) return;
			/* Wait for the content to be tall enough, or the scroll is clamped. */
			if (height < target) return;
			pendingRestore.current = null;
			restoreScroll(target);
		},
		[restoreScroll],
	);

	useFocusEffect(
		useCallback(() => {
			restoreScroll(scrollOffset.current);
		}, [restoreScroll]),
	);

	/*
	 * The spinner replaces the list outright, so remember where to come back to
	 * BEFORE the rows go away. Queued here rather than where the spinner is
	 * raised because a week change deliberately zeroes the offset first.
	 */
	useEffect(() => {
		if (isLoading && scrollOffset.current > 0) {
			pendingRestore.current = scrollOffset.current;
		}
	}, [isLoading]);

	/** The week currently on screen, so a re-subscribe can tell itself apart. */
	const loadedRange = useRef<string | null>(null);

	/*
	 * Live, bounded, server-filtered.
	 *
	 * v1 subscribed with an `await` on a helper that returned a Promise rather
	 * than an unsubscribe function, so the listener was never torn down — a new
	 * one leaked on every date-range change. It then fanned out a getUser() per
	 * distinct employee in the period.
	 */
	useEffect(() => {
		if (!companyId) return;

		const from = format(startDate, "yyyy-MM-dd");
		const to = format(endDate, "yyyy-MM-dd");
		const range = `${from}_${to}`;

		/*
		 * Only blank the list when what is on screen belongs to a DIFFERENT
		 * week. This effect also re-runs whenever the membership snapshot
		 * hands back a new lookup — showing a spinner for that threw the rows
		 * away and, with them, the reviewer's place in the list.
		 */
		if (loadedRange.current !== range) {
			/* A different week is a different list; landing mid-scroll in it
			   would drop you somewhere meaningless. */
			scrollOffset.current = 0;
			pendingRestore.current = null;
			setIsLoading(true);
		}

		return subscribeTimeEntries(
			companyId,
			{
				from,
				to,
				limit: 500,
			},
			(entries) => {
				const enriched = entries.map((entry) => {
					const member = membersById[entry.userId];
					return {
						...entry,
						userDetails: member
							? {
									id: member.userId,
									firstName: member.firstName,
									lastName: member.lastName,
									email: member.email,
								}
							: {
									id: entry.userId,
									// A removed member still has entries in the
									// period; naming them honestly beats
									// "Unknown Employee".
									firstName: "Former",
									lastName: "member",
									email: "",
								},
					};
				});

				setTimeEntries(enriched);

				const employeeIds = Array.from(
					new Set(enriched.map((e) => e.userId)),
				);
				if (employeeIds.length <= 3) {
					const expanded = {};
					employeeIds.forEach((id) => {
						expanded[id] = true;
					});
					setExpandedEmployees(expanded);
				}
				loadedRange.current = range;
				setIsLoading(false);
			},
		);
	}, [startDate, endDate, companyId, membersById]);

	// Group time entries by employee
	const entriesByEmployee = useMemo(() => {
		interface EmployeeGroup {
			userId: string;
			displayName: string;
			email: string;
			entries: TimeEntry[];
		}

		const grouped: Record<string, EmployeeGroup> = {};
		timeEntries.forEach((entry) => {
			const userId = entry.userId;
			if (!grouped[userId]) {
				grouped[userId] = {
					userId,
					displayName: entry.userDetails
						? `${entry.userDetails.firstName} ${entry.userDetails.lastName}`
						: "Unknown Employee",
					email: entry.userDetails?.email || "",
					entries: [],
				};
			}
			grouped[userId].entries.push(entry);
		});

		// Convert to array and sort by name
		return Object.values(grouped).sort((a, b) =>
			a.displayName.localeCompare(b.displayName),
		);
	}, [timeEntries]);

	// Toggle employee section expansion
	const toggleEmployeeExpansion = (userId) => {
		setExpandedEmployees((prev) => ({
			...prev,
			[userId]: !prev[userId],
		}));
	};

	// Navigate to time entry details
	const viewTimeEntryDetails = (employeeId, entryId) => {
		navigation.navigate("PayrollDetails", {
			entryId,
			employeeId,
		});
	};

	// Add this new function to navigate to TimeEntryDetails with all entries for an employee
	const viewEmployeeTimeEntries = (employeeId, entries) => {
		const entryId = entries.map((entry) => entry.id);

		navigation.navigate("PayrollDetails", {
			entryId,
			employeeId,
		});
	};

	// Go to previous week
	const goToPrevWeek = () => {
		setStartDate((prev) => subWeeks(prev, 1));
		setEndDate((prev) => subWeeks(prev, 1));
	};

	// Go to next week
	const goToNextWeek = () => {
		setStartDate((prev) => addWeeks(prev, 1));
		setEndDate((prev) => addWeeks(prev, 1));
	};

	// Reset to current week
	const goToCurrentWeek = () => {
		const weekStartsOn = preferences?.workWeekStarts == "sunday" ? 0 : 1;
		setStartDate(startOfWeek(new Date(), { weekStartsOn }));
		setEndDate(endOfWeek(new Date(), { weekStartsOn }));
	};

	// Handle date picker confirmations
	const handleStartDateConfirm = (date) => {
		setShowStartDatePicker(false);
		setStartDate(date);
	};

	const handleEndDateConfirm = (date) => {
		setShowEndDatePicker(false);
		setEndDate(date);
	};

	// Format duration for display (from seconds to h:mm format)
	const formatDuration = (durationSeconds) => {
		if (!durationSeconds && durationSeconds !== 0) return "—";

		const hours = Math.floor(durationSeconds / 3600);
		const minutes = Math.floor((durationSeconds % 3600) / 60);
		return `${hours}h ${minutes < 10 ? "0" : ""}${minutes}m`;
	};

	// Calculate total hours for an employee
	const getTotalHours = (entries) => {
		const totalSeconds = entries.reduce((sum, entry) => {
			return sum + (entry.workedSeconds || 0);
		}, 0);

		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		return { hours, minutes, totalSeconds };
	};

	// Calculate grand total for all displayed entries
	const grandTotal = useMemo(() => {
		const totalSeconds = timeEntries.reduce((sum, entry) => {
			return sum + (entry.workedSeconds || 0);
		}, 0);

		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		return { hours, minutes, totalSeconds };
	}, [timeEntries]);

	// Add this helper function near your other helper functions
	const areAllEntriesApproved = (entries) => {
		return (
			entries.length > 0 &&
			entries.every(
				(entry) =>
					entry.status === "approved" || entry.status === "rejected",
			)
		);
	};

	// Render individual time entry item
	const renderTimeEntryItem = ({ item }) => {
		const entryDate = item.clockInAt.toDate();

		return (
			<TouchableOpacity
				style={styles.timeEntryItem}
				onPress={() => viewTimeEntryDetails(item.userId, item.id)}
			>
				<View style={styles.timeEntryHeader}>
					<Text style={styles.timeEntryDate}>
						{format(entryDate, "EEE, MMM d")}
					</Text>
					<Text style={styles.timeEntryDuration}>
						{formatDuration(item.workedSeconds)}
					</Text>
				</View>

				<View style={styles.timeEntryDetails}>
					<View style={styles.timeColumn}>
						<Text style={styles.timeLabel}>Clock In</Text>
						<Text style={styles.timeValue}>
							{format(entryDate, "h:mm a")}
						</Text>
					</View>

					<Icon
						name="arrow-right"
						size={16}
						color={theme.colors.textTertiary}
						style={styles.arrow}
					/>

					<View style={styles.timeColumn}>
						<Text style={styles.timeLabel}>Clock Out</Text>
						<Text style={styles.timeValue}>
							{item.clockOutAt
								? format(item.clockOutAt.toDate(), "h:mm a")
								: "--:--"}
						</Text>
					</View>

					{/* Add flexible spacer */}
					<View style={{ flex: 1 }} />

					<View
						style={[
							styles.statusBadge,
							{ backgroundColor: getStatusColor(item.status) },
						]}
					>
						<Text style={styles.statusText}>
							{formatStatus(item.status)}
						</Text>
					</View>
				</View>
			</TouchableOpacity>
		);
	};

	// Helper function to format status
	const formatStatus = (status) => {
		switch (status) {
			case "pending_approval":
				return "Pending";
			case "approved":
				return "Approved";
			case "rejected":
				return "Rejected";
			case "completed":
				return "Not Submitted";
			case "edited":
				return "Edited";
			default:
				return "Active";
		}
	};

	// Helper function for status colors
	const getStatusColor = (status) => {
		switch (status) {
			case "pending_approval":
				return theme.colors.warning; // Orange
			case "approved":
				return theme.colors.success; // Green
			case "rejected":
				return theme.colors.danger; // Red
			case "completed":
				return theme.colors.danger; // Light Red
			case "edited":
				return theme.colors.accent; // Orange
			default:
				return theme.colors.accent; // Blue
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity
					containerStyle={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons
						name="chevron-back"
						size={28}
						color={theme.colors.text}
					/>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Payroll Review</Text>
			</View>

			{/* Date Range Selector */}
			<View style={styles.dateSelector}>
				<View style={styles.dateControls}>
					<TouchableOpacity
						onPress={goToPrevWeek}
						style={styles.dateNavButton}
					>
						<Icon
							name="chevron-left"
							size={24}
							color={theme.colors.accent}
						/>
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
						<Icon
							name="chevron-right"
							size={24}
							color={theme.colors.accent}
						/>
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
							color={theme.colors.textSecondary}
							style={styles.calendarIcon}
						/>
						<Text style={styles.dateText}>
							{format(startDate, "MMM d, yyyy")}
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
							color={theme.colors.textSecondary}
							style={styles.calendarIcon}
						/>
						<Text style={styles.dateText}>
							{format(endDate, "MMM d, yyyy")}
						</Text>
					</TouchableOpacity>
				</View>

				{/* Date pickers */}
				<DatePicker
					modal
					mode="date"
					theme={pickerTheme}
					open={showStartDatePicker}
					onConfirm={handleStartDateConfirm}
					onCancel={() => setShowStartDatePicker(false)}
					date={startDate}
				/>

				<DatePicker
					modal
					mode="date"
					theme={pickerTheme}
					open={showEndDatePicker}
					onConfirm={handleEndDateConfirm}
					onCancel={() => setShowEndDatePicker(false)}
					date={endDate}
				/>
			</View>

			{/* Grand Total */}
			<View style={styles.totalCard}>
				<Text style={styles.totalLabel}>Total Hours:</Text>
				<Text style={styles.totalHours}>
					{grandTotal.hours}h {grandTotal.minutes < 10 ? "0" : ""}
					{grandTotal.minutes}m
				</Text>
			</View>

			{/* Content */}
			{isLoading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator
						size="large"
						color={theme.colors.accent}
					/>
					<Text style={styles.loadingText}>
						Loading time entries...
					</Text>
				</View>
			) : entriesByEmployee.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Icon
						name="calendar-blank"
						size={48}
						color={theme.colors.borderStrong}
					/>
					<Text style={styles.emptyText}>
						No time entries found for this period
					</Text>
				</View>
			) : (
				<ScrollView
					ref={scrollRef}
					style={styles.content}
					onScroll={handleScroll}
					scrollEventThrottle={16}
					onContentSizeChange={handleContentSizeChange}
				>
					{entriesByEmployee.map((employeeGroup) => (
						<View
							key={employeeGroup.userId}
							style={styles.employeeSection}
						>
							<View style={styles.employeeHeader}>
								<TouchableOpacity
									style={styles.employeeHeaderMain}
									onPress={() =>
										viewEmployeeTimeEntries(
											employeeGroup.userId,
											employeeGroup.entries,
										)
									}
								>
									<View style={styles.employeeAvatar}>
										<Text style={styles.avatarText}>
											{employeeGroup.displayName
												.charAt(0)
												.toUpperCase()}
										</Text>
									</View>

									{/* Force minimum width and make sure text is visible */}
									<View
										style={[
											styles.employeeTextContainer,
											{ minWidth: 125 },
										]}
									>
										<Text
											style={[
												styles.employeeName,
												{ opacity: 1 },
											]}
											numberOfLines={1}
											ellipsizeMode="tail"
										>
											{employeeGroup.displayName ||
												"Unknown"}
										</Text>
										<Text
											style={[
												styles.employeeEmail,
												{ opacity: 1 },
											]}
											numberOfLines={1}
											ellipsizeMode="tail"
										>
											{employeeGroup.email || "No email"}
										</Text>
									</View>

									<Text style={styles.employeeHours}>
										{
											getTotalHours(employeeGroup.entries)
												.hours
										}
										h{" "}
										{getTotalHours(employeeGroup.entries)
											.minutes < 10
											? "0"
											: ""}
										{
											getTotalHours(employeeGroup.entries)
												.minutes
										}
										m
									</Text>

									{/* Add approved indicator */}
									{areAllEntriesApproved(
										employeeGroup.entries,
									) && (
										<View style={styles.approvedBadge}>
											<Icon
												name="check-circle"
												size={16}
												color={theme.colors.onAccent}
											/>
										</View>
									)}
								</TouchableOpacity>

								<TouchableOpacity
									style={styles.collapseButton}
									onPress={() =>
										toggleEmployeeExpansion(
											employeeGroup.userId,
										)
									}
									hitSlop={{
										top: 10,
										right: 10,
										bottom: 10,
										left: 10,
									}}
								>
									<Icon
										name={
											expandedEmployees[
												employeeGroup.userId
											]
												? "chevron-up"
												: "chevron-down"
										}
										size={24}
										color={theme.colors.textSecondary}
									/>
								</TouchableOpacity>
							</View>

							{expandedEmployees[employeeGroup.userId] && (
								<View style={styles.entriesContainer}>
									<FlatList
										data={employeeGroup.entries}
										keyExtractor={(item) => item.id}
										renderItem={renderTimeEntryItem}
										scrollEnabled={false}
									/>
								</View>
							)}
						</View>
					))}
				</ScrollView>
			)}
		</SafeAreaView>
	);
};

export default PayrollReview;
