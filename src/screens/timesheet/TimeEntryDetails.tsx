import React, { useState, useRef, useCallback } from "react";
import { StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useUser } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { getStatusBadgeColor, getStatusBadgeText } from "../../utils/timeUtils";
import { Text, Container } from "../../components/ui";
import {
	FieldTotalsCard,
	ExportSheet,
	EditSheet,
	ManagerActions,
	TimeDetailCard,
	TimeEntrySummary,
	TimeEntryDetailsHeader,
} from "../../components/time";
import { useTimeEntryDetails } from "../../hooks/timesheet/useTimeEntryDetails";
import { useTimeEntrySelection } from "../../hooks/timesheet/useTimeEntrySelection";
import { useTimeEntryActions } from "../../hooks/timesheet/useTimeEntryActions";

/**
 * TimeEntryDetails - Detailed view of time entries
 *
 * Shows comprehensive information about one or more time entries including:
 * - Summary with duration totals
 * - Field totals across entries
 * - Manager approval/rejection actions
 * - Individual entry cards with form responses
 * - Edit and export capabilities
 */
const TimeEntryDetails = ({ route, navigation }) => {
	// Extract params - handle both single ID and array of IDs
	const { entryId, userId: passedUserId } = route.params;
	const entryIdArray = Array.isArray(entryId) ? entryId : [entryId];

	const { userId: currentUserId, companyId, isAdmin } = useUser();
	const { theme } = useTheme();

	// Custom hooks for data management
	const {
		timeEntries,
		employeeUser,
		connectedEvents,
		attachmentMap,
		fieldTotals,
		totalDurationSeconds,
		totalDurationDecimal,
		isLoading,
		refetch,
	} = useTimeEntryDetails({
		entryIds: entryIdArray,
		companyId,
		passedUserId,
	});

	const {
		selectedEntries,
		selectAll,
		toggleEntrySelection,
		toggleSelectAll,
		getSelectedEntryIds,
		clearSelection,
	} = useTimeEntrySelection(timeEntries);

	const {
		isApproving,
		handleApproveEntries: approveEntries,
		handleRejectEntries: rejectEntries,
		handleSaveEntry,
		handleDeleteEntry: deleteEntry,
		handleFieldUpdate: updateField,
	} = useTimeEntryActions({
		companyId,
		userId: currentUserId,
		onSuccess: () => {
			refetch();
			clearSelection();
		},
	});

	// Modal state
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [exportModalVisible, setExportModalVisible] = useState(false);
	const [currentEditEntry, setCurrentEditEntry] = useState(null);
	const [editNotes, setEditNotes] = useState("");
	const [editChangeSummary, setEditChangeSummary] = useState("");

	// Bottom sheet refs
	const editBottomSheetRef = useRef(null);
	const exportBottomSheetRef = useRef(null);

	// Bottom sheet snap points
	const editSnapPoints = useRef(["80%"]).current;
	const exportSnapPoints = useRef(["50%"]).current;

	// Handle bottom sheet visibility
	React.useEffect(() => {
		if (editModalVisible && editBottomSheetRef.current) {
			editBottomSheetRef.current.expand();
		} else if (!editModalVisible && editBottomSheetRef.current) {
			editBottomSheetRef.current.close();
		}
	}, [editModalVisible]);

	React.useEffect(() => {
		if (exportModalVisible && exportBottomSheetRef.current) {
			exportBottomSheetRef.current.expand();
		} else if (!exportModalVisible && exportBottomSheetRef.current) {
			exportBottomSheetRef.current.close();
		}
	}, [exportModalVisible]);

	// Edit entry handler
	const handleEditEntry = useCallback((entry) => {
		setCurrentEditEntry(entry);
		setEditNotes(entry.notes || "");
		setEditChangeSummary("");
		setEditModalVisible(true);
	}, []);

	// Handlers for bottom sheets
	const handleEditSheetClose = useCallback(() => {
		setEditModalVisible(false);
	}, []);

	const handleExportSheetClose = useCallback(() => {
		setExportModalVisible(false);
	}, []);

	// Save edited entry
	const saveEditedEntry = async (updates: any) => {
		if (!currentEditEntry) return;
		await handleSaveEntry(currentEditEntry, updates, editChangeSummary);
		setEditModalVisible(false);
	};

	// Delete time entry
	const handleDeleteTimeEntry = () => {
		if (!currentEditEntry) return;

		deleteEntry(currentEditEntry, () => {
			// If viewing a single entry, navigate back
			if (timeEntries.length === 1) {
				navigation.goBack();
			}
		});
	};

	// Field update wrapper
	const handleFieldUpdate = async (
		entryId: string,
		fieldId: string,
		value: any,
	) => {
		await updateField(timeEntries, entryId, fieldId, value);
	};

	// Loading state
	if (isLoading) {
		return (
			<Container
				variant="page"
				includeSafeArea
				padding="lg"
				style={styles.loadingContainer}
			>
				<ActivityIndicator size="large" color={theme.LocationBlue} />
				<Text style={styles.loadingText}>
					Loading time entry details...
				</Text>
			</Container>
		);
	}

	return (
		<Container
			variant="page"
			includeSafeArea
			safeEdges={["bottom"]}
			padding="none"
		>
			{/* Header */}
			<TimeEntryDetailsHeader
				entryCount={timeEntries.length}
				isAdmin={isAdmin}
				onBack={() => navigation.goBack()}
				onExport={() => setExportModalVisible(true)}
			/>

			<ScrollView
				style={styles.scrollContainer}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{/* Summary Card */}
				<TimeEntrySummary
					status={timeEntries[0]?.status || "draft"}
					employeeUser={employeeUser}
					totalDurationSeconds={totalDurationSeconds}
					totalDurationDecimal={totalDurationDecimal}
					timeEntries={timeEntries}
					getStatusBadgeColor={getStatusBadgeColor}
					getStatusBadgeText={getStatusBadgeText}
				/>

				{/* Field Totals Card */}
				{Object.keys(fieldTotals).length > 0 && (
					<FieldTotalsCard fieldTotals={fieldTotals} />
				)}

				{/* Manager Actions */}
				{isAdmin && timeEntries.length > 0 && (
					<ManagerActions
						selectAll={selectAll}
						toggleSelectAll={toggleSelectAll}
						selectedCount={getSelectedEntryIds().length}
						totalCount={timeEntries.length}
						isApproving={isApproving}
						onApprove={() => approveEntries(getSelectedEntryIds())}
						onReject={() => rejectEntries(getSelectedEntryIds())}
					/>
				)}

				{/* Time Entries List */}
				{timeEntries.map((entry) => (
					<TimeDetailCard
						key={entry.id}
						entry={entry}
						isSelected={selectedEntries[entry.id]}
						isAdmin={isAdmin}
						onToggleSelection={toggleEntrySelection}
						onEditEntry={handleEditEntry}
						attachmentMap={attachmentMap}
						connectedEvents={connectedEvents[entry.id] || []}
						onFieldUpdate={handleFieldUpdate}
					/>
				))}
			</ScrollView>

			{/* Edit Modal */}
			<EditSheet
				ref={editBottomSheetRef}
				visible={editModalVisible}
				snapPoints={editSnapPoints}
				timeEntry={currentEditEntry}
				editNotes={editNotes}
				editChangeSummary={editChangeSummary}
				setEditNotes={setEditNotes}
				setEditChangeSummary={setEditChangeSummary}
				onClose={handleEditSheetClose}
				onSave={saveEditedEntry}
				onDelete={handleDeleteTimeEntry}
			/>

			{/* Export Modal */}
			<ExportSheet
				ref={exportBottomSheetRef}
				visible={exportModalVisible}
				snapPoints={exportSnapPoints}
				onClose={handleExportSheetClose}
				selectedEntries={getSelectedEntryIds()}
				timeEntries={timeEntries}
				employeeUser={employeeUser}
				companyId={companyId}
			/>
		</Container>
	);
};

const styles = StyleSheet.create({
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
	scrollContainer: {
		flex: 1,
		marginTop: 12,
	},
	scrollContent: {
		paddingBottom: 32,
	},
});

export default TimeEntryDetails;
