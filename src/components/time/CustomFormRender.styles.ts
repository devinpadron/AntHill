import { StyleSheet } from "react-native";

/** Presentation only — extracted verbatim from CustomFormRender.tsx. */
export const styles = StyleSheet.create({
	customFormCard: {
		backgroundColor: "#f7fbff",
		borderRadius: 8,
		padding: 16,
		marginBottom: 16,
		borderLeftWidth: 3,
		borderLeftColor: "#5856d6",
	},
	cardTitle: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333",
		marginBottom: 8,
	},
	formDescription: {
		fontSize: 14,
		color: "#666",
		marginBottom: 16,
	},
	formField: {
		marginBottom: 16,
	},
	fieldLabel: {
		fontSize: 15,
		fontWeight: "500",
		marginBottom: 8,
		color: "#333",
	},
	requiredIndicator: {
		color: "#FF3B30",
		fontWeight: "bold",
	},
	textInput: {
		height: 44,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		backgroundColor: "white",
	},
	checkboxContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	checkbox: {
		marginRight: 10,
	},
	checkboxLabel: {
		fontSize: 16,
		color: "#333",
	},
	dropdownContainer: {
		marginBottom: 10,
		position: "relative",
	},
	dropdown: {
		borderColor: "#ccc",
		backgroundColor: "white",
		minHeight: 44,
	},
	dropdownList: {
		borderColor: "#ccc",
		backgroundColor: "white",
		elevation: 5,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
	},
	dateButton: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		height: 44,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 8,
		paddingHorizontal: 12,
		backgroundColor: "white",
	},
	dateText: {
		fontSize: 16,
		color: "#333",
	},
	datePlaceholder: {
		fontSize: 16,
		color: "#999",
	},
	errorText: {
		color: "#FF3B30",
		fontSize: 12,
		marginTop: 4,
	},
	multiplierResult: {
		marginTop: 8,
	},
	multiplierText: {
		fontSize: 14,
		color: "#333",
	},
	uploaderContainer: {
		marginVertical: 10,
	},
	filePreviewContainer: {
		marginTop: 8,
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	filePreview: {
		width: 80,
		height: 80,
		borderRadius: 4,
		backgroundColor: "#f0f0f0",
		justifyContent: "center",
		alignItems: "center",
	},
	imagePreview: {
		width: 80,
		height: 80,
		borderRadius: 4,
		resizeMode: "cover",
	},
	docPreviewText: {
		fontSize: 10,
		color: "#666",
		textAlign: "center",
		marginTop: 4,
		paddingHorizontal: 2,
	},
	expandableInput: {
		minHeight: 48,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		fontSize: 16,
		backgroundColor: "white",
		textAlignVertical: "center",
	},
	checklistContainer: {
		gap: 12,
	},
	checklistItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 4,
	},
	checklistLabel: {
		fontSize: 16,
		color: "#333",
		marginLeft: 10,
		flex: 1,
	},
});
