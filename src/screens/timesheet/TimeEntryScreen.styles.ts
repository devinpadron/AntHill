import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from TimeEntryScreen.tsx. */
export const styles = StyleSheet.create({
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
	weekNavigator: {
		backgroundColor: "white",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
		marginBottom: 8,
	},
	dateControls: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
	},
	dateNavButton: {
		paddingHorizontal: 32,
	},
	currentWeekButton: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		backgroundColor: "#f0f0ff",
		borderRadius: 16,
	},
	currentWeekText: {
		color: "#007AFF",
		fontWeight: "500",
		fontSize: 14,
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
	sectionTitleButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 6,
		marginBottom: 12,
	},
});
