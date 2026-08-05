import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from TimeDetailCard.tsx. */
export const styles = StyleSheet.create({
	timeEntryCard: {
		marginHorizontal: 16,
		marginBottom: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		overflow: "hidden",
	},
	timeEntryHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	headerLeftSection: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	selectionCheckbox: {
		marginRight: 12,
	},
	dateTimeText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	/*
	 * Sits BELOW the header, not inside it. The header is flexDirection:"row",
	 * so placing this there made it a third column competing for width with the
	 * date and the status badge — the caveat text had nowhere to wrap and
	 * pushed everything sideways.
	 */
	reviewLine: {
		paddingHorizontal: 16,
		paddingBottom: 12,
	},
	reviewText: { fontSize: 12, color: "#555", flexShrink: 1 },
	reviewCaveat: {
		fontSize: 11,
		lineHeight: 15,
		color: "#8a6d3b",
		fontStyle: "italic",
		marginTop: 2,
		flexShrink: 1,
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
	timeEntryDetails: {
		padding: 16,
	},
	detailRow: {
		flexDirection: "row",
		marginBottom: 8,
	},
	detailLabel: {
		fontSize: 15,
		color: "#666",
		width: 80,
	},
	detailValue: {
		fontSize: 15,
		color: "#333",
		flex: 1,
	},
	notesSection: {
		marginTop: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginBottom: 8,
	},
	notesText: {
		fontSize: 15,
		color: "#333",
		lineHeight: 22,
	},
	formResponsesSection: {
		marginTop: 16,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
		paddingTop: 16,
	},
	formResponseItem: {
		marginBottom: 12,
	},
	formFieldLabel: {
		fontSize: 14,
		color: "#666",
		marginBottom: 4,
	},
	entryActions: {
		marginTop: 16,
		flexDirection: "row",
		justifyContent: "flex-end",
	},
	editButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
		backgroundColor: "#f0f7ff",
	},
	editButtonText: {
		marginLeft: 6,
		fontSize: 14,
		fontWeight: "500",
		color: "#007AFF",
	},
	connectedEventsSection: {
		marginTop: 16,
	},
	connectedEventContainer: {
		marginBottom: 16,
		borderWidth: 1,
		borderColor: "#f0f0f0",
		borderRadius: 8,
		overflow: "hidden",
	},
	connectedEventItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 10,
		paddingHorizontal: 12,
		backgroundColor: "#f7f9fc",
		borderBottomColor: "#f0f0f0",
	},
	eventTitle: {
		fontSize: 15,
		fontWeight: "500",
		color: "#333",
		marginLeft: 8,
	},
	eventMetadata: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: "#f9f9f9",
	},
	metadataText: {
		fontSize: 13,
		color: "#666",
		fontStyle: "italic",
	},
	eventFormResponsesSection: {
		padding: 12,
		backgroundColor: "#ffffff",
	},
	eventFormTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		marginBottom: 8,
	},
	editHistorySection: {
		marginTop: 16,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
	},
	editHistoryItem: {
		marginBottom: 12,
		padding: 10,
		backgroundColor: "#f8f8f8",
		borderRadius: 6,
		borderLeftWidth: 3,
		borderLeftColor: "#007AFF",
	},
	editTimestamp: {
		fontSize: 13,
		color: "#666",
		marginBottom: 4,
	},
	editSummary: {
		fontSize: 14,
		color: "#333",
		fontWeight: "500",
	},
	quickEditContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	quickEditButton: {
		padding: 4,
		borderRadius: 4,
		backgroundColor: "#f0f7ff",
		marginLeft: 8,
	},
	editableFieldContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	editableInput: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#007AFF",
		borderRadius: 4,
		padding: 8,
		fontSize: 15,
		color: "#333",
		backgroundColor: "#fff",
	},
	saveButton: {
		marginLeft: 8,
		padding: 8,
		borderRadius: 4,
		backgroundColor: "#007AFF",
		alignItems: "center",
		justifyContent: "center",
	},
	packageInfoSection: {
		padding: 12,
		backgroundColor: "#f7f9fc",
		borderTopWidth: 1,
		borderTopColor: "#eeeeee",
	},
	packageSectionTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		marginBottom: 8,
	},
	packageItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 4,
	},
	packageName: {
		fontSize: 14,
		color: "#333",
		marginLeft: 8,
	},
	packageInfoText: {
		fontSize: 14,
		color: "#666",
		fontStyle: "italic",
		textAlign: "center",
		marginTop: 4,
	},
	pauseValue: {
		fontSize: 15,
		flex: 1,
	},
});
