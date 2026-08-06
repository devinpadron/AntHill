import { StyleSheet } from "react-native";
import { Theme } from "../../../theme";

/** Presentation only — extracted verbatim from ChecklistCreator.tsx. */
export const checklistStyles = (theme: Theme) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.colors.surfaceSunken,
		},
		header: {
			padding: 15,
			backgroundColor: theme.colors.surface,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
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
			color: theme.colors.text,
		},
		headerSubtitle: {
			fontSize: 16,
			color: theme.colors.textSecondary,
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
			color: theme.colors.textSecondary,
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
			color: theme.colors.textSecondary,
			marginTop: 10,
		},
		emptySubtext: {
			fontSize: 14,
			color: theme.colors.textTertiary,
			marginTop: 5,
			textAlign: "center",
		},
		checklistCard: {
			backgroundColor: theme.colors.surface,
			borderRadius: 8,
			padding: 15,
			marginBottom: 15,
			shadowColor: theme.colors.shadow,
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
			color: theme.colors.text,
			flex: 1,
			flexWrap: "wrap",
		},
		itemCount: {
			fontSize: 14,
			color: theme.colors.textSecondary,
			backgroundColor: theme.colors.border,
			paddingHorizontal: 8,
			paddingVertical: 4,
			borderRadius: 12,
		},
		checklistActions: {
			flexDirection: "row",
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
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
			color: theme.colors.text,
		},
		footer: {
			padding: 15,
			backgroundColor: theme.colors.surface,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
		},
		editorFooter: {
			padding: 15,
			backgroundColor: theme.colors.surface,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
			flexDirection: "row", // Added to ensure buttons align horizontally
		},
		createButton: {
			backgroundColor: theme.colors.success,
			borderRadius: 8,
			padding: 15,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
		},
		createButtonText: {
			color: theme.colors.surface,
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
			color: theme.colors.text,
			marginBottom: 8,
		},
		input: {
			backgroundColor: theme.colors.surface,
			borderWidth: 1,
			borderColor: theme.colors.border,
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
			backgroundColor: theme.colors.surface,
			borderWidth: 1,
			borderColor: theme.colors.border,
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
			backgroundColor: theme.colors.surface,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			padding: 12,
			marginBottom: 10,
			flexDirection: "row",
			alignItems: "center",
		},
		itemText: {
			flex: 1,
			fontSize: 16,
			color: theme.colors.text,
			flexWrap: "wrap",
		},
		removeButton: {
			padding: 5,
		},
		saveButton: {
			flex: 2,
			backgroundColor: theme.colors.accent,
			borderRadius: 8,
			padding: 15,
			alignItems: "center",
			justifyContent: "center",
		},
		saveButtonText: {
			color: theme.colors.surface,
			fontSize: 16,
			fontWeight: "bold",
		},
		cancelButton: {
			flex: 1,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			padding: 15,
			alignItems: "center",
			justifyContent: "center",
			marginRight: 10,
			backgroundColor: theme.colors.surfaceSunken, // Added for better visibility
		},
		cancelButtonText: {
			color: theme.colors.text, // Darkened for better contrast
			fontSize: 16,
			fontWeight: "500", // Added for better visibility
		},
	});
