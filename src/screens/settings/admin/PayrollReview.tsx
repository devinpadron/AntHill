import React, { useState, useEffect, useMemo } from "react";
import {
	View,
	Text,
	StyleSheet,
	FlatList,
	SafeAreaView,
	ActivityIndicator,
	ScrollView,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import {
	format,
	startOfWeek,
	endOfWeek,
	addDays,
	addWeeks,
	subWeeks,
	parseISO,
} from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useUser } from "../../../contexts/UserContext";
import { getAllTimeEntries } from "../../../services/timeEntryService";
import { getUser } from "../../../services/userService";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import { useCompany } from "../../../contexts/CompanyContext";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

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

	// Fetch time entries when screen comes into focus
	useFocusEffect(
		useCallback(() => {
			// This will execute when the screen comes into focus
			fetchTimeEntries();
			return () => {
				// Optional cleanup function
			};
		}, [startDate, endDate, companyId]),
	);

	// Fetch time entries for the selected date range
	const fetchTimeEntries = async () => {
		if (!companyId) return;

		setIsLoading(true);
		try {
			// Get all entries for company within date range
			// We'll filter by status "pending_approval" or "approved" on the front-end
			const entries = await getAllTimeEntries(
				null, // No specific userId, get all employees
				companyId,
				startDate.toISOString(),
				endDate.toISOString(),
			);

			// Get user details for each unique userId
			const userIds = Array.from(
				new Set(entries.map((entry) => entry.userId)),
			);
			const userPromises = userIds.map((id) => getUser(id));
			const users = await Promise.all(userPromises);

			// Create userId -> userDetails map
			const userMap = {};
			users.forEach((user) => {
				if (user) userMap[user.id] = user;
			});

			// Enrich entries with user details
			const enrichedEntries = entries.map((entry) => ({
				...entry,
				userDetails: userMap[entry.userId] || {
					firstName: "Unknown",
					lastName: "Employee",
					email: "",
					id: entry.userId,
					companies: [],
					loggedInCompany: "",
				},
			}));

			setTimeEntries(enrichedEntries);

			// Auto-expand sections if there are only a few employees
			const uniqueEmployees = Array.from(
				new Set(enrichedEntries.map((entry) => entry.userId)),
			);
			if (uniqueEmployees.length <= 3) {
				const expanded = {};
				uniqueEmployees.forEach((id) => {
					expanded[id] = true;
				});
				setExpandedEmployees(expanded);
			}
		} catch (error) {
			console.error("Error fetching time entries:", error);
		} finally {
			setIsLoading(false);
		}
	};

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
			return sum + (entry.duration || 0);
		}, 0);

		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		return { hours, minutes, totalSeconds };
	};

	// Calculate grand total for all displayed entries
	const grandTotal = useMemo(() => {
		const totalSeconds = timeEntries.reduce((sum, entry) => {
			return sum + (entry.duration || 0);
		}, 0);

		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		return { hours, minutes, totalSeconds };
	}, [timeEntries]);

	// Render individual time entry item
	const renderTimeEntryItem = ({ item }) => {
		const entryDate = parseISO(item.clockInTime);

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
						{formatDuration(item.duration)}
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
							{item.clockOutTime
								? format(parseISO(item.clockOutTime), "h:mm a")
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
											{ minWidth: 150 },
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

									{/* Add spacing between name and hours */}
									<View style={{ width: 8 }} />

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

const styles = StyleSheet.create({
	backButton: {
		position: "absolute",
		left: 20,
		zIndex: 1,
	},
	container: {
		flex: 1,
		backgroundColor: "white",
	},
	header: {
		paddingHorizontal: 16,
		paddingVertical: 16,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
		//flexDirection: "row",
		justifyContent: "center",
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
	},
	dateSelector: {
		backgroundColor: "white",
		paddingHorizontal: 16,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	dateControls: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
	},
	dateNavButton: {
		padding: 8,
	},
	currentWeekButton: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		backgroundColor: "#f0f7ff",
		borderRadius: 16,
	},
	currentWeekText: {
		color: "#007AFF",
		fontWeight: "500",
	},
	dateRange: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginTop: 8,
	},
	dateButton: {
		flexDirection: "row",
		alignItems: "center",
		padding: 8,
		backgroundColor: "#f2f2f2",
		borderRadius: 8,
	},
	calendarIcon: {
		marginRight: 6,
	},
	dateText: {
		fontSize: 14,
		color: "#333",
	},
	dateRangeSeparator: {
		marginHorizontal: 8,
		color: "#666",
	},
	totalCard: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		backgroundColor: "white",
		padding: 16,
		marginVertical: 8,
		marginHorizontal: 16,
		borderRadius: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	totalLabel: {
		fontSize: 16,
		fontWeight: "500",
		color: "#333",
	},
	totalHours: {
		fontSize: 18,
		fontWeight: "700",
		color: "#007AFF",
	},
	content: {
		flex: 1,
		padding: 16,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 12,
		fontSize: 16,
		color: "#666",
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingTop: 60,
	},
	emptyText: {
		marginTop: 12,
		fontSize: 16,
		color: "#666",
		textAlign: "center",
	},
	employeeSection: {
		backgroundColor: "white",
		borderRadius: 8,
		marginBottom: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		overflow: "hidden",
	},
	employeeHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	employeeHeaderMain: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center", // Center items vertically
	},
	employeeInfo: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1, // Add flex to make it take available space
		marginRight: 8, // Add margin to prevent overlap
	},
	collapseButton: {
		paddingLeft: 16,
		alignItems: "center",
		justifyContent: "center",
		flexShrink: 0, // Prevent button from shrinking
	},
	employeeAvatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: "#007AFF",
		justifyContent: "center",
		alignItems: "center",
		marginRight: 12,
		flexShrink: 0, // Prevent avatar from shrinking
	},
	avatarText: {
		color: "white",
		fontWeight: "600",
		fontSize: 18,
	},
	avatarImage: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	employeeTextContainer: {
		flex: 1,
		marginRight: 8,
		justifyContent: "center",
		// Add these debugging styles to see container boundaries
		// backgroundColor: '#f0f0f0', // Uncomment to debug layout
		minWidth: 10, // Ensure container has minimum width
	},
	employeeName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333", // Make sure color contrasts with background
		marginBottom: 2,
		marginRight: 0,
		opacity: 1,
		includeFontPadding: false, // Fix Android text rendering
	},
	employeeEmail: {
		fontSize: 12,
		color: "#666",
		// Add these to ensure text is visible
		opacity: 1,
		includeFontPadding: false, // Fix Android text rendering
	},
	employeeHeaderRight: {
		flexDirection: "row",
		alignItems: "center",
	},
	employeeHours: {
		fontSize: 16,
		fontWeight: "600",
		color: "#007AFF",
		marginLeft: 8,
		paddingLeft: 8,
		flexShrink: 0, // Prevent hours from shrinking
	},

	entriesContainer: {
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	timeEntryItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	timeEntryHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	timeEntryDate: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
	},
	timeEntryDuration: {
		fontSize: 14,
		fontWeight: "600",
		color: "#007AFF",
	},
	timeEntryDetails: {
		flexDirection: "row",
		alignItems: "center",
		flexWrap: "nowrap", // Ensure row doesn't wrap
		width: "100%", // Ensure it takes full width
	},
	timeColumn: {
		marginRight: 12,
		flexShrink: 0, // Prevent time columns from shrinking
	},
	timeLabel: {
		fontSize: 12,
		color: "#666",
	},
	timeValue: {
		fontSize: 14,
		color: "#333",
	},
	arrow: {
		marginHorizontal: 4,
		flexShrink: 0, // Prevent arrow from shrinking
	},
	statusBadge: {
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 12,
		// Removed marginLeft: "auto" and replaced with flex layout
		flexShrink: 0, // Prevent badge from shrinking
	},
	statusText: {
		fontSize: 12,
		fontWeight: "500",
		color: "white",
	},
});

export default PayrollReview;
