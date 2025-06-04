import React from "react";
import { View, Text, StyleSheet } from "react-native";

const FieldTotalsCard = ({ fieldTotals }) => {
	// If no totals, don't render anything
	if (!fieldTotals || Object.keys(fieldTotals).length === 0) {
		return null;
	}

	// Separate time entry totals and event totals
	const timeEntryTotals = {};
	const eventTotals = {};

	Object.entries(fieldTotals).forEach(([key, data]: any) => {
		if (data.source === "event") {
			eventTotals[key] = data;
		} else {
			timeEntryTotals[key] = data;
		}
	});

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Form Totals</Text>

			{/* Time Entry Totals */}
			{Object.keys(timeEntryTotals).length > 0 && (
				<>
					<Text style={styles.sectionTitle}>Timesheet</Text>
					{Object.entries(timeEntryTotals).map(
						([fieldId, data]: any) => (
							<View key={fieldId} style={styles.totalRow}>
								<Text style={styles.fieldLabel}>
									{data.label}:
								</Text>
								<View style={styles.valueContainer}>
									<Text style={styles.fieldValue}>
										{data.total.toFixed(2)} {data.unit}
									</Text>

									{data.useMultiplier &&
										data.multipliedTotal !== undefined && (
											<Text
												style={styles.multipliedValue}
											>
												(
												{data.multipliedTotal.toFixed(
													2,
												)}{" "}
												{data.unit})
											</Text>
										)}
								</View>
							</View>
						),
					)}
				</>
			)}

			{/* Event Totals */}
			{Object.keys(eventTotals).length > 0 && (
				<>
					<Text style={[styles.sectionTitle, { marginTop: 16 }]}>
						Events
					</Text>
					{Object.entries(eventTotals).map(([fieldId, data]: any) => (
						<View key={fieldId} style={styles.totalRow}>
							<Text style={styles.fieldLabel}>{data.label}:</Text>
							<View style={styles.valueContainer}>
								<Text style={styles.fieldValue}>
									{data.total.toFixed(2)} {data.unit}
								</Text>

								{data.useMultiplier &&
									data.multipliedTotal !== undefined && (
										<Text style={styles.multipliedValue}>
											({data.multipliedTotal.toFixed(2)}{" "}
											{data.unit})
										</Text>
									)}
							</View>
						</View>
					))}
				</>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		margin: 16,
		marginTop: 0,
		marginBottom: 16,
		padding: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	title: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		marginBottom: 8,
		paddingBottom: 4,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	totalRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
		paddingBottom: 8,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	fieldLabel: {
		fontSize: 15,
		color: "#666",
		flex: 1,
	},
	valueContainer: {
		flex: 1,
		alignItems: "flex-end",
	},
	fieldValue: {
		fontSize: 15,
		fontWeight: "500",
		color: "#333",
	},
	multipliedValue: {
		fontSize: 14,
		color: "#007AFF",
		marginTop: 2,
	},
});

export default FieldTotalsCard;
