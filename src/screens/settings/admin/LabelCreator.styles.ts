import { StyleSheet } from "react-native";
import { Theme } from "../../../theme";

/** Presentation only — extracted verbatim from LabelCreator.tsx. */
export const labelStyles = (theme: Theme) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.colors.surfaceSunken,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 16,
			paddingVertical: 12,
			backgroundColor: theme.colors.surface,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
		},
		headerTitle: {
			fontSize: 18,
			fontWeight: "600",
			color: theme.colors.text,
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
			backgroundColor: theme.colors.surface,
			borderRadius: 12,
			marginBottom: 16,
			overflow: "hidden",
			shadowColor: theme.colors.shadow,
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
			borderBottomColor: theme.colors.border,
		},
		formIcon: {
			marginRight: 10,
		},
		formTitle: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		formContent: {
			padding: 16,
		},
		inputLabel: {
			fontSize: 14,
			fontWeight: "500",
			color: theme.colors.textSecondary,
			marginBottom: 8,
		},
		textInput: {
			height: 48,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingHorizontal: 16,
			fontSize: 16,
			color: theme.colors.text,
			backgroundColor: theme.colors.surfaceSunken,
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
			borderColor: theme.colors.text,
		},
		labelPreview: {
			marginTop: 24,
			marginBottom: 16,
		},
		previewTitle: {
			fontSize: 14,
			fontWeight: "500",
			color: theme.colors.textSecondary,
			marginBottom: 8,
		},
		previewLabel: {
			alignSelf: "flex-start",
			paddingHorizontal: 16,
			paddingVertical: 8,
			borderRadius: 16,
		},
		previewText: {
			color: theme.colors.surface,
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
			borderColor: theme.colors.textTertiary,
		},
		cancelButtonText: {
			color: theme.colors.textSecondary,
		},
		saveButton: {
			flex: 1,
		},
		listCard: {
			backgroundColor: theme.colors.surface,
			borderRadius: 12,
			marginBottom: 16,
			overflow: "hidden",
			shadowColor: theme.colors.shadow,
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
			borderBottomColor: theme.colors.border,
		},
		listIcon: {
			marginRight: 10,
		},
		listTitle: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		loadingContainer: {
			padding: 24,
			alignItems: "center",
		},
		loadingText: {
			marginTop: 8,
			fontSize: 14,
			color: theme.colors.textSecondary,
		},
		emptyContainer: {
			padding: 24,
			alignItems: "center",
		},
		emptyText: {
			marginTop: 12,
			fontSize: 14,
			color: theme.colors.textSecondary,
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
			borderBottomColor: theme.colors.border,
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
			color: theme.colors.text,
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
			backgroundColor: theme.colors.surface,
			borderRadius: 12,
			marginBottom: 16,
			overflow: "hidden",
			shadowColor: theme.colors.shadow,
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.1,
			shadowRadius: 3,
			elevation: 2,
			borderLeftWidth: 4,
			borderLeftColor: theme.colors.accent,
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
			color: theme.colors.textSecondary,
		},
	});
