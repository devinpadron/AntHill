import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from EventDetails.tsx. */
export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	scrollContent: {
		padding: 16,
		paddingBottom: 80, // Extra padding for floating button
	},
	card: {
		backgroundColor: "#FFFFFF",
		borderRadius: 12,
		padding: 16,
		marginBottom: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	dateTimeContainer: {
		flexDirection: "column",
	},
	dateContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	timeContainer: {
		flexDirection: "row",
		alignItems: "flex-start",
	},
	timeTextContainer: {
		flexDirection: "column",
	},
	icon: {
		marginRight: 8,
	},
	dateText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	timeText: {
		fontSize: 17,
		fontWeight: "500",
		color: "#333",
	},
	durationText: {
		fontSize: 14,
		color: "#666",
		marginTop: 4,
	},
	section: {
		marginBottom: 8,
	},
	sectionDivider: {
		paddingTop: 16,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
		marginTop: 16,
	},
	sectionHeaderContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 17,
		fontWeight: "600",
		color: "#333",
	},
	text: {
		fontSize: 16,
		lineHeight: 22,
		color: "#444",
	},
	map: {
		height: 220,
		borderRadius: 8,
		overflow: "hidden",
	},
	packageCard: {
		backgroundColor: "#f9f9f9",
		borderRadius: 10,
		padding: 14,
		borderWidth: 1,
		borderColor: "#eee",
	},
	packageCardMargin: {
		marginBottom: 12,
	},
	packageHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	packageTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		flex: 1,
	},
	packageDescription: {
		fontSize: 14,
		lineHeight: 20,
		color: "#666",
		marginBottom: 10,
	},
	checklistButton: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#e6f2ff",
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 16,
	},
	checklistButtonText: {
		fontSize: 13,
		fontWeight: "500",
		color: "#2089dc",
		marginLeft: 4,
	},
	checklistCount: {
		fontSize: 15,
		fontWeight: "400",
		color: "#666",
	},
	packageChecklists: {
		marginTop: 10,
		backgroundColor: "#f0f0f0",
		borderRadius: 8,
		padding: 10,
	},
	packageChecklistItem: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 6,
	},
	checklistIcon: {
		marginRight: 8,
	},
	packageChecklistTitle: {
		fontSize: 14,
		color: "#333",
	},
	moreChecklists: {
		fontSize: 13,
		color: "#666",
		marginTop: 4,
		fontStyle: "italic",
	},
	notesContainer: {
		borderWidth: 1,
		borderColor: "#eee",
		borderRadius: 8,
		backgroundColor: "#fff",
	},
	editingNotesContainer: {
		borderColor: "#2089dc",
		backgroundColor: "#f0f8ff",
	},
	notesInput: {
		fontSize: 16,
		lineHeight: 22,
		padding: 12,
		minHeight: 120,
		color: "#444",
	},
	editHint: {
		fontSize: 13,
		fontStyle: "italic",
		color: "#888",
		fontWeight: "400",
		marginLeft: 6,
	},
	floatingChecklistButton: {
		position: "absolute",
		bottom: 20,
		right: 20,
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#2089dc",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 30,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 6,
	},
	floatingButtonText: {
		color: "#fff",
		fontWeight: "600",
		fontSize: 15,
		marginLeft: 8,
	},
	bottomSpace: {
		height: 40,
	},
	labelContainer: {
		marginBottom: 12,
		paddingTop: 8,
		paddingHorizontal: 4,
		alignItems: "center",
		justifyContent: "center",
	},
	labelBadge: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 1,
	},
	labelText: {
		color: "white",
		fontSize: 14,
		fontWeight: "500",
		textShadowColor: "rgba(0, 0, 0, 0.3)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
});
