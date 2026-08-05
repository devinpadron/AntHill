import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from TimeEntrySubmitModal.tsx. */
export const styles = StyleSheet.create({
	sheetBackground: {
		backgroundColor: "white",
	},
	sheetIndicator: {
		backgroundColor: "#ccc",
		width: 40,
		height: 4,
	},
	scrollContent: {
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
		paddingBottom: 12,
		paddingHorizontal: 20,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	entryDetails: {
		backgroundColor: "#f7f7f7",
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
	},
	detailRow: {
		flexDirection: "row",
		marginBottom: 6,
	},
	detailLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		width: 70,
	},
	detailValue: {
		fontSize: 14,
		color: "#333",
		flex: 1,
	},
	notesLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
		marginBottom: 6,
	},
	notesInput: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 14,
		color: "#333",
		height: 100,
		textAlignVertical: "top",
		marginBottom: 16,
	},
	errorText: {
		color: "#ff3b30",
		marginBottom: 12,
	},
	buttonRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	button: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	cancelButton: {
		backgroundColor: "#f2f2f2",
		flex: 1,
		marginRight: 8,
	},
	submitButton: {
		backgroundColor: "#007AFF",
		flex: 2,
	},
	disabledButton: {
		backgroundColor: "#80b3ff",
	},
	cancelButtonText: {
		color: "#666",
		fontWeight: "500",
	},
	submitButtonText: {
		color: "white",
		fontWeight: "600",
	},
	eventsCard: {
		backgroundColor: "#f0f7ff",
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
		borderLeftWidth: 3,
		borderLeftColor: "#007AFF",
	},
	cardTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333",
		marginBottom: 8,
	},
	relatedEventsContainer: {
		marginTop: 2,
	},
	eventItem: {
		fontSize: 14,
		color: "#333",
		marginLeft: 4,
		marginTop: 2,
		lineHeight: 20,
	},
	eventsLoadingContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	loadingText: {
		fontSize: 14,
		color: "#666",
		marginLeft: 8,
	},
	eventRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 6,
	},
	eventInfo: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	eventActionButton: {
		padding: 4,
	},
	noEventsText: {
		fontStyle: "italic",
		color: "#666",
		marginVertical: 4,
	},
	toggleOtherEventsButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 8,
		marginTop: 8,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 122, 255, 0.2)",
	},
	toggleButtonText: {
		color: "#007AFF",
		fontSize: 14,
		marginRight: 4,
	},
	otherEventsContainer: {
		marginTop: 8,
		paddingTop: 8,
	},
	otherEventsTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		marginBottom: 8,
	},
	otherEventItem: {
		fontSize: 14,
		color: "#666",
		marginLeft: 4,
	},
	uploadProgressContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f0f7ff",
		padding: 12,
		borderRadius: 8,
		marginBottom: 16,
	},
	uploadProgressText: {
		marginLeft: 8,
		color: "#007AFF",
		fontSize: 14,
	},
	addEventButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 8,
		marginTop: 6,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 122, 255, 0.2)",
	},
	addEventButtonText: {
		color: "#007AFF",
		fontSize: 14,
		marginLeft: 4,
	},
	addEventInputContainer: {
		marginTop: 8,
		borderTopWidth: 1,
		borderTopColor: "rgba(0, 122, 255, 0.2)",
		paddingTop: 8,
	},
	addEventInput: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 8,
		fontSize: 14,
	},
	addEventButtonsRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		marginTop: 8,
	},
	addEventCancelButton: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		marginRight: 8,
	},
	addEventCancelText: {
		color: "#666",
	},
	addEventSaveButton: {
		backgroundColor: "#007AFF",
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 6,
	},
	addEventSaveText: {
		color: "white",
		fontWeight: "500",
	},
	eventFormsContainer: {
		marginBottom: 16,
	},
	eventFormsTitle: {
		fontSize: 15,
		fontWeight: "600",
		marginBottom: 8,
	},
	eventFormContainer: {
		backgroundColor: "#f7f9fc",
		borderRadius: 8,
		padding: 12,
		marginBottom: 12,
		borderLeftWidth: 3,
		borderLeftColor: "#007AFF",
	},
	eventFormHeader: {
		marginBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
		paddingBottom: 8,
	},
	eventFormTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: "#333",
	},
});
