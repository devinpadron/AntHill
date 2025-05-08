// Time Entry Screen Component
import React from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	FlatList,
	SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format, startOfWeek, endOfWeek } from "date-fns";
import TimeEntryCard from "../../components/time/TimeEntryCard";
import { useTimeTracking } from "../../hooks/useTimeTracking";

// Time Entry Screen Component
const TimeEntryScreen = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const {
		timeEntries,
		activeTimeEntry,
		isLoading,
		isClockedIn,
		clockIn,
		clockOut,
		weeklyStats,
	} = useTimeTracking();

	// Weekly summary data
	const today = new Date();
	const weekStart = startOfWeek(today, { weekStartsOn: 0 });
	const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

	// View time entry details
	const viewTimeEntryDetails = (entryId) => {
		//navigation.navigate("TimeEntryDetail", { entryId });
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
								name="clock-outline"
								size={24}
								color="#ff9500"
								style={styles.clockIcon}
							/>
							<Text style={styles.clockedInText}>
								Clocked in at{" "}
								{format(
									new Date(activeTimeEntry.clockInTime),
									"h:mm a",
								)}
							</Text>
						</View>
						<TouchableOpacity
							style={[styles.clockButton, styles.clockOutButton]}
							onPress={clockOut}
						>
							<Text style={styles.clockButtonText}>
								CLOCK OUT
							</Text>
						</TouchableOpacity>
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
					renderItem={({ item }) => (
						<TimeEntryCard
							timeEntry={item}
							onPress={() => viewTimeEntryDetails(item.id)}
						/>
					)}
					ListEmptyComponent={
						<View style={styles.emptyContainer}>
							<Text style={styles.emptyText}>
								No time entries found
							</Text>
						</View>
					}
				/>
			</View>
		</SafeAreaView>
	);
};

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
	},
	clockInButton: {
		backgroundColor: "#34C759",
	},
	clockOutButton: {
		backgroundColor: "#ff3b30",
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
});

export default TimeEntryScreen;
