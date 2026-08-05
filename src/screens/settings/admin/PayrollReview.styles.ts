import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from PayrollReview.tsx. */
export const styles = StyleSheet.create({
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
		flexShrink: 0, // Prevent hours from shrinking
	},
	approvedBadge: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: "#4CAF50",
		justifyContent: "center",
		alignItems: "center",
		marginLeft: 8,
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
