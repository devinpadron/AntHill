import { StyleSheet } from "react-native";
import { Theme } from "../../theme";

/** Presentation only — extracted verbatim from TimeEntrySubmitModal.tsx. */
export const submitModalStyles = (theme: Theme) =>
	StyleSheet.create({
		sheetBackground: {
			backgroundColor: theme.colors.surface,
		},
		sheetIndicator: {
			backgroundColor: theme.colors.border,
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
			borderBottomColor: theme.colors.border,
		},
		modalTitle: {
			color: theme.colors.text,
			fontSize: 18,
			fontWeight: "600",
		},
		entryDetails: {
			backgroundColor: theme.colors.surfaceSunken,
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
			color: theme.colors.textSecondary,
			width: 70,
		},
		detailValue: {
			fontSize: 14,
			color: theme.colors.text,
			flex: 1,
		},
		notesLabel: {
			fontSize: 14,
			fontWeight: "500",
			color: theme.colors.text,
			marginBottom: 6,
		},
		notesInput: {
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			padding: 12,
			fontSize: 14,
			color: theme.colors.text,
			height: 100,
			textAlignVertical: "top",
			marginBottom: 16,
		},
		errorText: {
			color: theme.colors.danger,
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
			backgroundColor: theme.colors.surfaceSunken,
			flex: 1,
			marginRight: 8,
		},
		submitButton: {
			backgroundColor: theme.colors.accent,
			flex: 2,
		},
		disabledButton: {
			backgroundColor: theme.colors.accentBorder,
		},
		cancelButtonText: {
			color: theme.colors.textSecondary,
			fontWeight: "500",
		},
		submitButtonText: {
			color: theme.colors.surface,
			fontWeight: "600",
		},
		eventsCard: {
			backgroundColor: theme.colors.accentSubtle,
			borderRadius: 8,
			padding: 12,
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
		relatedEventsContainer: {
			marginTop: 2,
		},
		eventItem: {
			fontSize: 14,
			color: theme.colors.text,
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
			color: theme.colors.textSecondary,
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
			color: theme.colors.textSecondary,
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
			color: theme.colors.accent,
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
			color: theme.colors.textSecondary,
			marginBottom: 8,
		},
		otherEventItem: {
			fontSize: 14,
			color: theme.colors.textSecondary,
			marginLeft: 4,
		},
		uploadProgressContainer: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: theme.colors.accentSubtle,
			padding: 12,
			borderRadius: 8,
			marginBottom: 16,
		},
		uploadProgressText: {
			marginLeft: 8,
			color: theme.colors.accent,
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
			color: theme.colors.accent,
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
			color: theme.colors.text,
			borderWidth: 1,
			borderColor: theme.colors.border,
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
			color: theme.colors.textSecondary,
		},
		addEventSaveButton: {
			backgroundColor: theme.colors.accent,
			paddingVertical: 6,
			paddingHorizontal: 12,
			borderRadius: 6,
		},
		addEventSaveText: {
			color: theme.colors.surface,
			fontWeight: "500",
		},
		eventFormsContainer: {
			marginBottom: 16,
		},
		eventFormsTitle: {
			color: theme.colors.text,
			fontSize: 15,
			fontWeight: "600",
			marginBottom: 8,
		},
		eventFormContainer: {
			backgroundColor: theme.colors.surfaceSunken,
			borderRadius: 8,
			padding: 12,
			marginBottom: 12,
			borderLeftWidth: 3,
			borderLeftColor: theme.colors.accent,
		},
		eventFormHeader: {
			marginBottom: 12,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
			paddingBottom: 8,
		},
		eventFormTitle: {
			fontSize: 14,
			fontWeight: "600",
			color: theme.colors.text,
		},
	});
