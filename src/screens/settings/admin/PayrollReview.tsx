import React, { useState, useEffect, useMemo } from "react";
import {
	View,
	Text,
	FlatList,
	SafeAreaView,
	ActivityIndicator,
	ScrollView,
	RefreshControl,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
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
import { styles } from "./PayrollReview.styles";

const PayrollReview = ({ navigation }) => {
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
	 * Live, bounded, server-filtered.
	 *
	 * v1 subscribed with an `await` on a helper that returned a Promise rather
	 * than an unsubscribe function, so the listener was never torn down — a new
	 * one leaked on every date-range change. It then fanned out a getUser() per
	 * distinct employee in the period.
	 */
	useEffect(() => {
		if (!companyId) return;
		setIsLoading(true);

		return subscribeTimeEntries(
			companyId,
			{
				from: format(startDate, "yyyy-MM-dd"),
				to: format(endDate, "yyyy-MM-dd"),
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
			entries: any[];
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
						color="#999"
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
				return "#FFB74D"; // Orange
			case "approved":
				return "#81C784"; // Green
			case "rejected":
				return "#E57373"; // Red
			case "completed":
				return "#FF8A65"; // Light Red
			case "edited":
				return "#90CAF9"; // Orange
			default:
				return "#90CAF9"; // Blue
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity
					containerStyle={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons name="chevron-back" size={28} color="#000" />
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
							color="#666"
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
					open={showStartDatePicker}
					onConfirm={handleStartDateConfirm}
					onCancel={() => setShowStartDatePicker(false)}
					date={startDate}
				/>

				<DatePicker
					modal
					mode="date"
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
					<ActivityIndicator size="large" color="#007AFF" />
					<Text style={styles.loadingText}>
						Loading time entries...
					</Text>
				</View>
			) : entriesByEmployee.length === 0 ? (
				<View style={styles.emptyContainer}>
					<Icon name="calendar-blank" size={48} color="#ccc" />
					<Text style={styles.emptyText}>
						No time entries found for this period
					</Text>
				</View>
			) : (
				<ScrollView style={styles.content}>
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
												color="#fff"
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
										color="#666"
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
