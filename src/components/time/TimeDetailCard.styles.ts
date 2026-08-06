import { StyleSheet } from "react-native";
import { Theme } from "../../theme";

/** Presentation only — extracted verbatim from TimeDetailCard.tsx. */
export const timeDetailCardStyles = (theme: Theme) =>
	StyleSheet.create({
		timeEntryCard: {
			marginHorizontal: 16,
			marginBottom: 16,
			backgroundColor: theme.colors.surface,
			borderRadius: 12,
			shadowColor: theme.colors.shadow,
			shadowOffset: { width: 0, height: 1 },
			shadowOpacity: 0.1,
			shadowRadius: 2,
			elevation: 2,
			overflow: "hidden",
		},
		timeEntryHeader: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			padding: 16,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
		},
		headerLeftSection: {
			flexDirection: "row",
			alignItems: "center",
			flex: 1,
		},
		selectionCheckbox: {
			marginRight: 12,
		},
		dateTimeText: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
		},
		/*
		 * Sits BELOW the header, not inside it. The header is flexDirection:"row",
		 * so placing this there made it a third column competing for width with the
		 * date and the status badge — the caveat text had nowhere to wrap and
		 * pushed everything sideways.
		 */
		reviewLine: {
			paddingHorizontal: 16,
			paddingBottom: 12,
		},
		reviewText: {
			fontSize: 12,
			color: theme.colors.textSecondary,
			flexShrink: 1,
		},
		reviewCaveat: {
			fontSize: 11,
			lineHeight: 15,
			color: theme.colors.warning,
			fontStyle: "italic",
			marginTop: 2,
			flexShrink: 1,
		},
		statusBadge: {
			flexShrink: 0,
		},
		timeEntryDetails: {
			padding: 16,
		},
		detailRow: {
			flexDirection: "row",
			marginBottom: 8,
		},
		detailLabel: {
			fontSize: 15,
			color: theme.colors.textSecondary,
			width: 80,
		},
		detailValue: {
			fontSize: 15,
			color: theme.colors.text,
			flex: 1,
		},
		notesSection: {
			marginTop: 16,
		},
		sectionTitle: {
			fontSize: 16,
			fontWeight: "600",
			color: theme.colors.text,
			marginBottom: 8,
		},
		notesText: {
			fontSize: 15,
			color: theme.colors.text,
			lineHeight: 22,
		},
		formResponsesSection: {
			marginTop: 16,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
			paddingTop: 16,
		},
		formResponseItem: {
			marginBottom: 12,
		},
		formFieldLabel: {
			fontSize: 14,
			color: theme.colors.textSecondary,
			marginBottom: 4,
		},
		entryActions: {
			marginTop: 16,
			flexDirection: "row",
			justifyContent: "flex-end",
		},
		editButton: {
			flexDirection: "row",
			alignItems: "center",
			paddingVertical: 8,
			paddingHorizontal: 12,
			borderRadius: 6,
			backgroundColor: theme.colors.accentSubtle,
		},
		editButtonText: {
			marginLeft: 6,
			fontSize: 14,
			fontWeight: "500",
			color: theme.colors.accent,
		},
		connectedEventsSection: {
			marginTop: 16,
		},
		connectedEventContainer: {
			marginBottom: 16,
			borderWidth: 1,
			borderColor: theme.colors.border,
			borderRadius: 8,
			overflow: "hidden",
		},
		connectedEventItem: {
			flexDirection: "row",
			alignItems: "center",
			paddingVertical: 10,
			paddingHorizontal: 12,
			backgroundColor: theme.colors.surfaceSunken,
			borderBottomColor: theme.colors.border,
		},
		eventTitle: {
			fontSize: 15,
			fontWeight: "500",
			color: theme.colors.text,
			marginLeft: 8,
		},
		eventMetadata: {
			paddingHorizontal: 12,
			paddingVertical: 8,
			backgroundColor: theme.colors.surfaceSunken,
		},
		metadataText: {
			fontSize: 13,
			color: theme.colors.textSecondary,
			fontStyle: "italic",
		},
		eventFormResponsesSection: {
			padding: 12,
			backgroundColor: theme.colors.surface,
		},
		eventFormTitle: {
			fontSize: 14,
			fontWeight: "500",
			color: theme.colors.textSecondary,
			marginBottom: 8,
		},
		editHistorySection: {
			marginTop: 16,
			paddingTop: 12,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
		},
		editHistoryItem: {
			marginBottom: 12,
			padding: 10,
			backgroundColor: theme.colors.surfaceSunken,
			borderRadius: 6,
			borderLeftWidth: 3,
			borderLeftColor: theme.colors.accent,
		},
		editTimestamp: {
			fontSize: 13,
			color: theme.colors.textSecondary,
			marginBottom: 4,
		},
		editSummary: {
			fontSize: 14,
			color: theme.colors.text,
			fontWeight: "500",
		},
		quickEditContainer: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		quickEditButton: {
			padding: 4,
			borderRadius: 4,
			backgroundColor: theme.colors.accentSubtle,
			marginLeft: 8,
		},
		editableFieldContainer: {
			flexDirection: "row",
			alignItems: "center",
		},
		editableInput: {
			flex: 1,
			borderWidth: 1,
			borderColor: theme.colors.accent,
			borderRadius: 4,
			padding: 8,
			fontSize: 15,
			color: theme.colors.text,
			backgroundColor: theme.colors.surface,
		},
		saveButton: {
			marginLeft: 8,
			padding: 8,
			borderRadius: 4,
			backgroundColor: theme.colors.accent,
			alignItems: "center",
			justifyContent: "center",
		},
		packageInfoSection: {
			padding: 12,
			backgroundColor: theme.colors.surfaceSunken,
			borderTopWidth: 1,
			borderTopColor: theme.colors.border,
		},
		packageSectionTitle: {
			fontSize: 14,
			fontWeight: "500",
			color: theme.colors.textSecondary,
			marginBottom: 8,
		},
		packageItem: {
			flexDirection: "row",
			alignItems: "center",
			paddingVertical: 4,
		},
		packageName: {
			fontSize: 14,
			color: theme.colors.text,
			marginLeft: 8,
		},
		packageInfoText: {
			fontSize: 14,
			color: theme.colors.textSecondary,
			fontStyle: "italic",
			textAlign: "center",
			marginTop: 4,
		},
		pauseValue: {
			fontSize: 15,
			flex: 1,
		},
	});
