import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { format } from "date-fns";
import { formatDuration } from "../../utils/timeUtils";

const TimeEntrySummary = ({
	employeeUser,
	totalDurationSeconds,
	totalDurationDecimal,
	timeEntries,
	status,
	getStatusBadgeColor,
	getStatusBadgeText,
}) => {
	return (
		<View style={styles.summaryCard}>
			<View style={styles.summaryRow}>
				<Text style={styles.summaryLabel}>Employee:</Text>
				<Text style={styles.summaryValue}>
					{employeeUser?.firstName + " " + employeeUser?.lastName ||
						"Unknown"}
				</Text>
			</View>

			<View style={[styles.summaryRow, styles.totalSummaryRow]}>
				<Text style={styles.summaryLabel}>Total Duration:</Text>
				<Text style={[styles.summaryValue, styles.totalValue]}>
					{formatDuration(totalDurationSeconds)} (
					{totalDurationDecimal} hrs)
				</Text>
			</View>

			<View style={styles.summaryRow}>
				<Text style={styles.summaryLabel}>Status:</Text>
				<View style={styles.statusContainer}>
					{timeEntries.length === 1 ? (
						<View
							style={[
								styles.statusBadge,
								{
									backgroundColor: getStatusBadgeColor(
										timeEntries[0].status,
									),
								},
							]}
						>
							<Text style={styles.statusText}>
								{getStatusBadgeText(timeEntries[0].status)}
							</Text>
						</View>
					) : (
						<Text style={styles.statusText}>Multiple</Text>
					)}
				</View>
			</View>

			<View style={styles.summaryRow}>
				<Text style={styles.summaryLabel}>Date Range:</Text>
				<Text style={styles.summaryValue}>
					{timeEntries.length > 0
						? `${format(
								new Date(timeEntries[0].clockInTime),
								"MMM d, yyyy",
							)}
              ${
					timeEntries.length > 1
						? " - " +
							format(
								new Date(
									timeEntries[timeEntries.length - 1]
										.clockInTime,
								),
								"MMM d, yyyy",
							)
						: ""
				}`
						: "N/A"}
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	summaryCard: {
		margin: 16,
		padding: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 12,
		alignItems: "center",
	},
	totalSummaryRow: {
		marginTop: 8,
		paddingTop: 8,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
	},
	summaryLabel: {
		fontSize: 16,
		color: "#666",
		fontWeight: "500",
	},
	summaryValue: {
		fontSize: 14,
		color: "#333",
		fontWeight: "500",
		textAlign: "right",
		flex: 1,
	},
	totalValue: {
		fontWeight: "600",
		color: "#007AFF",
		fontSize: 15,
	},
	statusContainer: {
		flexDirection: "row",
		justifyContent: "flex-end",
	},
	statusBadge: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 12,
		backgroundColor: "#e0e0e0",
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#555",
	},
});

export default TimeEntrySummary;
