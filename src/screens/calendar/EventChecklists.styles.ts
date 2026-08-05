import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from EventChecklists.tsx. */
export const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
		backgroundColor: "white",
	},
	backButton: {
		padding: 8,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: "#666",
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	emptyTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#333",
		marginTop: 16,
		marginBottom: 8,
	},
	emptyText: {
		fontSize: 16,
		color: "#666",
		textAlign: "center",
	},
	checklistHeader: {
		backgroundColor: "white",
		padding: 16,
		borderRadius: 8,
		marginBottom: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	titleContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	checklistTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#333",
		flex: 1,
	},
	completedTitle: {
		color: "#4CAF50",
	},
	completedIcon: {
		marginLeft: 8,
	},
	progressContainer: {
		marginTop: 12,
		flexDirection: "row",
		alignItems: "center",
	},
	progressBar: {
		flex: 1,
		height: 8,
		backgroundColor: "#e0e0e0",
		borderRadius: 4,
		overflow: "hidden",
		marginRight: 8,
	},
	progressFill: {
		height: "100%",
		backgroundColor: "#4CAF50",
		borderRadius: 4,
	},
	progressText: {
		fontSize: 14,
		color: "#666",
		width: 40,
		textAlign: "right",
	},
	itemsContainer: {
		flex: 1,
	},
	checklistItem: {
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
		padding: 16,
	},
	firstItem: {
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
	},
	lastItem: {
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
		borderBottomWidth: 0,
	},
	itemContent: {
		flexDirection: "row",
		alignItems: "center",
	},
	checkboxContainer: {
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	uncheckedBox: {
		width: 22,
		height: 22,
		borderWidth: 2,
		borderColor: "#bdbdbd",
		borderRadius: 22,
	},
	itemText: {
		fontSize: 16,
		color: "#333",
		flex: 1,
	},
	checkedText: {
		color: "#4CAF50",
	},
	strikethroughText: {
		color: "#9E9E9E",
		textDecorationLine: "line-through",
	},
	scrollContainer: {
		flex: 1,
	},
	contentContainer: {
		padding: 16,
		paddingBottom: 24, // Extra padding at bottom
	},
	checklistSection: {
		marginBottom: 24,
	},
	itemsList: {
		backgroundColor: "white",
		borderRadius: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	emptyItemsContainer: {
		padding: 16,
		alignItems: "center",
		justifyContent: "center",
	},
});
