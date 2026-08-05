import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from ChecklistCreator.tsx. */
export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f5f5",
	},
	header: {
		padding: 15,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	backButton: {
		padding: 5,
		marginRight: 10,
	},
	headerTextContainer: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333",
	},
	headerSubtitle: {
		fontSize: 16,
		color: "#666",
		marginTop: 5,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: "#666",
	},
	listContainer: {
		flex: 1,
	},
	listContent: {
		padding: 15,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingBottom: 100,
	},
	emptyText: {
		fontSize: 18,
		color: "#666",
		marginTop: 10,
	},
	emptySubtext: {
		fontSize: 14,
		color: "#999",
		marginTop: 5,
		textAlign: "center",
	},
	checklistCard: {
		backgroundColor: "#fff",
		borderRadius: 8,
		padding: 15,
		marginBottom: 15,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	checklistHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		marginBottom: 10,
	},
	checklistTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#333",
		flex: 1,
		flexWrap: "wrap",
	},
	itemCount: {
		fontSize: 14,
		color: "#666",
		backgroundColor: "#f0f0f0",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	checklistActions: {
		flexDirection: "row",
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
		paddingTop: 10,
		marginTop: 5,
	},
	actionButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		padding: 8,
	},
	actionText: {
		marginLeft: 5,
		fontSize: 14,
		color: "#333",
	},
	footer: {
		padding: 15,
		backgroundColor: "#fff",
		borderTopWidth: 1,
		borderTopColor: "#e0e0e0",
	},
	editorFooter: {
		padding: 15,
		backgroundColor: "#fff",
		borderTopWidth: 1,
		borderTopColor: "#e0e0e0",
		flexDirection: "row", // Added to ensure buttons align horizontally
	},
	createButton: {
		backgroundColor: "#4CAF50",
		borderRadius: 8,
		padding: 15,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	createButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
		marginLeft: 8,
	},
	editorContainer: {
		flex: 1,
		padding: 15,
	},
	formGroup: {
		marginBottom: 20,
	},
	label: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#333",
		marginBottom: 8,
	},
	input: {
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		minHeight: 44,
	},
	itemInputContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	itemInput: {
		flex: 1,
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		minHeight: 44,
	},
	addButton: {
		padding: 8,
		marginLeft: 8,
	},
	itemsList: {
		marginTop: 10,
		marginBottom: 20,
	},
	itemContainer: {
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		marginBottom: 10,
		flexDirection: "row",
		alignItems: "center",
	},
	itemText: {
		flex: 1,
		fontSize: 16,
		color: "#333",
		flexWrap: "wrap",
	},
	removeButton: {
		padding: 5,
	},
	saveButton: {
		flex: 2,
		backgroundColor: "#2196F3",
		borderRadius: 8,
		padding: 15,
		alignItems: "center",
		justifyContent: "center",
	},
	saveButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
	},
	cancelButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 15,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 10,
		backgroundColor: "#f5f5f5", // Added for better visibility
	},
	cancelButtonText: {
		color: "#333", // Darkened for better contrast
		fontSize: 16,
		fontWeight: "500", // Added for better visibility
	},
});
