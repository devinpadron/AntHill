import { StyleSheet } from "react-native";
import { Theme } from "../../theme";

/** Presentation only — extracted verbatim from CustomFormRender.tsx. */
export const customFormStyles = (theme: Theme) =>
	StyleSheet.create({
		customFormCard: {
			backgroundColor: theme.colors.accentSubtle,
			borderRadius: 8,
			padding: 16,
			marginBottom: 16,
			borderLeftWidth: 3,
			borderLeftColor: theme.colors.accent,
		},
		cardTitle: {
			fontSize: 15,
			fontWeight: "600",
			color: theme.colors.text,
			marginBottom: 8,
		},
		formDescription: {
			fontSize: 14,
			color: theme.colors.textSecondary,
			marginBottom: 16,
		},
		formField: {
			marginBottom: 16,
		},
		fieldLabel: {
			fontSize: 15,
			fontWeight: "500",
			marginBottom: 8,
			color: theme.colors.text,
		},
		requiredIndicator: {
			color: theme.colors.danger,
			fontWeight: "bold",
		},
		textInput: {
			height: 44,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingHorizontal: 12,
			fontSize: 16,
			backgroundColor: theme.colors.surface,
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
			color: theme.colors.text,
		},
		dropdownContainer: {
			marginBottom: 10,
			position: "relative",
		},
		dropdown: {
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.surface,
			minHeight: 44,
		},
		dropdownList: {
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.surface,
			elevation: 5,
			shadowColor: theme.colors.shadow,
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
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingHorizontal: 12,
			backgroundColor: theme.colors.surface,
		},
		dateText: {
			fontSize: 16,
			color: theme.colors.text,
		},
		datePlaceholder: {
			fontSize: 16,
			color: theme.colors.textTertiary,
		},
		errorText: {
			color: theme.colors.danger,
			fontSize: 12,
			marginTop: 4,
		},
		multiplierResult: {
			marginTop: 8,
		},
		multiplierText: {
			fontSize: 14,
			color: theme.colors.text,
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
			backgroundColor: theme.colors.border,
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
			color: theme.colors.textSecondary,
			textAlign: "center",
			marginTop: 4,
			paddingHorizontal: 2,
		},
		expandableInput: {
			minHeight: 48,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			paddingHorizontal: 12,
			paddingVertical: 8,
			fontSize: 16,
			backgroundColor: theme.colors.surface,
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
			color: theme.colors.text,
			marginLeft: 10,
			flex: 1,
		},
	});
