import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from LabelCreator.tsx. */
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
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
		flex: 1,
	},
	backButton: {
		padding: 8,
	},
	scrollView: {
		flex: 1,
	},
	contentContainer: {
		padding: 16,
		paddingBottom: 32,
	},
	formCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	formHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	formIcon: {
		marginRight: 10,
	},
	formTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	formContent: {
		padding: 16,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#555",
		marginBottom: 8,
	},
	textInput: {
		height: 48,
		borderWidth: 1,
		borderColor: "#e0e0e0",
		borderRadius: 8,
		paddingHorizontal: 16,
		fontSize: 16,
		color: "#333",
		backgroundColor: "#f9f9f9",
	},
	colorContainer: {
		marginTop: 8,
	},
	colorOption: {
		width: 36,
		height: 36,
		borderRadius: 18,
		margin: 6,
	},
	selectedColorOption: {
		borderWidth: 3,
		borderColor: "#333",
	},
	labelPreview: {
		marginTop: 24,
		marginBottom: 16,
	},
	previewTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#555",
		marginBottom: 8,
	},
	previewLabel: {
		alignSelf: "flex-start",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 16,
	},
	previewText: {
		color: "white",
		fontWeight: "500",
		fontSize: 14,
		textShadowColor: "rgba(0, 0, 0, 0.3)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	buttonContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 16,
	},
	cancelButton: {
		flex: 1,
		marginRight: 8,
		backgroundColor: "transparent",
		borderWidth: 1,
		borderColor: "#999",
	},
	cancelButtonText: {
		color: "#666",
	},
	saveButton: {
		flex: 1,
	},
	listCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	listHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	listIcon: {
		marginRight: 10,
	},
	listTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	loadingContainer: {
		padding: 24,
		alignItems: "center",
	},
	loadingText: {
		marginTop: 8,
		fontSize: 14,
		color: "#666",
	},
	emptyContainer: {
		padding: 24,
		alignItems: "center",
	},
	emptyText: {
		marginTop: 12,
		fontSize: 14,
		color: "#666",
	},
	labelsList: {
		padding: 8,
	},
	labelItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	labelItemContent: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	labelColor: {
		width: 24,
		height: 24,
		borderRadius: 12,
		marginRight: 12,
	},
	labelName: {
		fontSize: 16,
		color: "#333",
	},
	labelActions: {
		flexDirection: "row",
	},
	editButton: {
		padding: 8,
		marginRight: 8,
	},
	deleteButton: {
		padding: 8,
	},
	infoCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
		borderLeftWidth: 4,
		borderLeftColor: "#2089dc",
	},
	infoContent: {
		padding: 16,
		flexDirection: "row",
		alignItems: "flex-start",
	},
	infoIcon: {
		marginRight: 12,
		marginTop: 2,
	},
	infoText: {
		flex: 1,
		fontSize: 14,
		lineHeight: 20,
		color: "#666",
	},
});
