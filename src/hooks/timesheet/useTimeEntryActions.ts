import { useState, useCallback } from "react";
import { Alert } from "react-native";
import {
	updateTimeEntry,
	deleteTimeEntry,
} from "../../services/timeEntryService";
import { TimeEntry } from "../../types";

interface UseTimeEntryActionsParams {
	companyId: string;
	userId: string;
	onSuccess?: () => void;
}

interface UseTimeEntryActionsReturn {
	isApproving: boolean;
	handleApproveEntries: (entryIds: string[]) => Promise<void>;
	handleRejectEntries: (entryIds: string[]) => Promise<void>;
	handleSaveEntry: (
		entry: TimeEntry,
		updates: any,
		changeSummary: string,
	) => Promise<void>;
	handleDeleteEntry: (entry: TimeEntry, onNavigateBack?: () => void) => void;
	handleFieldUpdate: (
		timeEntries: TimeEntry[],
		entryId: string,
		fieldId: string,
		value: any,
	) => Promise<void>;
}

/**
 * useTimeEntryActions - Manages time entry actions and state updates
 *
 * Handles:
 * - Approving time entries
 * - Rejecting time entries
 * - Editing/updating time entries
 * - Deleting time entries
 * - Updating individual form fields
 */
export const useTimeEntryActions = ({
	companyId,
	userId,
	onSuccess,
}: UseTimeEntryActionsParams): UseTimeEntryActionsReturn => {
	const [isApproving, setIsApproving] = useState(false);

	const handleApproveEntries = useCallback(
		async (entryIds: string[]) => {
			if (entryIds.length === 0) {
				Alert.alert(
					"No entries selected",
					"Please select entries to approve.",
				);
				return;
			}

			try {
				setIsApproving(true);

				// Process each entry sequentially
				for (const entryId of entryIds) {
					await updateTimeEntry(entryId, companyId, {
						status: "approved",
						approvedAt: new Date().toISOString(),
						approvedBy: userId,
					});
				}

				// Trigger success callback to refresh data
				onSuccess?.();

				// Show success message
				Alert.alert(
					"Success",
					`${entryIds.length} time ${
						entryIds.length === 1 ? "entry" : "entries"
					} approved successfully.`,
				);
			} catch (error) {
				console.error("Error approving time entries:", error);
				Alert.alert(
					"Error",
					"Failed to approve time entries. Please try again.",
				);
			} finally {
				setIsApproving(false);
			}
		},
		[companyId, userId, onSuccess],
	);

	const handleRejectEntries = useCallback(
		async (entryIds: string[]) => {
			if (entryIds.length === 0) {
				Alert.alert(
					"No entries selected",
					"Please select entries to reject.",
				);
				return;
			}

			// Show rejection confirmation dialog
			Alert.alert(
				"Confirm Rejection",
				"Are you sure you want to reject the selected time entries?",
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Reject",
						style: "destructive",
						onPress: async () => {
							try {
								setIsApproving(true);

								// Process each entry sequentially
								for (const entryId of entryIds) {
									await updateTimeEntry(entryId, companyId, {
										status: "rejected",
										rejectedAt: new Date().toISOString(),
										rejectedBy: userId,
									});
								}

								// Trigger success callback to refresh data
								onSuccess?.();

								// Show success message
								Alert.alert(
									"Success",
									`${entryIds.length} time ${
										entryIds.length === 1
											? "entry"
											: "entries"
									} rejected successfully.`,
								);
							} catch (error) {
								console.error(
									"Error rejecting time entries:",
									error,
								);
								Alert.alert(
									"Error",
									"Failed to reject time entries. Please try again.",
								);
							} finally {
								setIsApproving(false);
							}
						},
					},
				],
			);
		},
		[companyId, userId, onSuccess],
	);

	const handleSaveEntry = useCallback(
		async (entry: TimeEntry, updates: any, changeSummary: string) => {
			try {
				// Prepare updated data with edit history
				const updatedData = {
					...updates,
					editHistory: [
						...(entry.editHistory || []),
						{
							timestamp: new Date().toISOString(),
							userId,
							changeSummary:
								changeSummary || "Updated time entry",
						},
					],
				};

				// Update the time entry
				await updateTimeEntry(entry.id, companyId, updatedData);

				// Trigger success callback to refresh data
				onSuccess?.();

				// Show success message
				Alert.alert("Success", "Time entry updated successfully");
			} catch (error) {
				console.error("Error updating time entry:", error);
				Alert.alert(
					"Error",
					"Failed to update time entry. Please try again.",
				);
				throw error;
			}
		},
		[companyId, userId, onSuccess],
	);

	const handleDeleteEntry = useCallback(
		(entry: TimeEntry, onNavigateBack?: () => void) => {
			// Show confirmation dialog
			Alert.alert(
				"Confirm Deletion",
				"Are you sure you want to delete this time entry? This action cannot be undone.",
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Delete",
						style: "destructive",
						onPress: async () => {
							try {
								await deleteTimeEntry(entry.id, companyId);

								// If navigation callback provided, call it
								if (onNavigateBack) {
									onNavigateBack();
									return;
								}

								// Otherwise trigger success callback
								onSuccess?.();

								Alert.alert(
									"Success",
									"Time entry deleted successfully",
								);
							} catch (error) {
								console.error(
									"Error deleting time entry:",
									error,
								);
								Alert.alert(
									"Error",
									"Failed to delete time entry. Please try again.",
								);
							}
						},
					},
				],
			);
		},
		[companyId, onSuccess],
	);

	const handleFieldUpdate = useCallback(
		async (
			timeEntries: TimeEntry[],
			entryId: string,
			fieldId: string,
			value: any,
		) => {
			try {
				// For entry fields
				if (!fieldId.includes("_")) {
					const entry = timeEntries.find((e) => e.id === entryId);
					if (!entry) throw new Error("Entry not found");

					const updatedFormResponses = {
						...entry.formResponses,
						[fieldId]: value,
					};

					await updateTimeEntry(entryId, companyId, {
						formResponses: updatedFormResponses,
						editHistory: [
							...(entry.editHistory || []),
							{
								timestamp: new Date().toISOString(),
								userId,
								changeSummary: `Updated field: ${fieldId}`,
							},
						],
					});
				}
				// For connected event fields
				else {
					const [eventId, eventFieldId] = fieldId.split("_");

					const entry = timeEntries.find((e) => e.id === entryId);
					if (!entry || !entry.connectedEvents)
						throw new Error("Entry or connected events not found");

					const updatedConnectedEvents = entry.connectedEvents.map(
						(event: any) => {
							if (event.eventId === eventId) {
								return {
									...event,
									formResponses: {
										...(event.formResponses || {}),
										[eventFieldId]: value,
									},
								};
							}
							return event;
						},
					);
					await updateTimeEntry(entryId, companyId, {
						connectedEvents: updatedConnectedEvents,
						editHistory: [
							...(entry.editHistory || []),
							{
								timestamp: new Date().toISOString(),
								userId,
								changeSummary: `Updated event field: ${eventFieldId}`,
							},
						],
					});
				}

				// Trigger success callback to refresh data
				onSuccess?.();
			} catch (error) {
				console.error("Error updating field:", error);
				throw error;
			}
		},
		[companyId, userId, onSuccess],
	);

	return {
		isApproving,
		handleApproveEntries,
		handleRejectEntries,
		handleSaveEntry,
		handleDeleteEntry,
		handleFieldUpdate,
	};
};
