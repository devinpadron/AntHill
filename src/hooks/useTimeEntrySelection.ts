import { useState, useCallback, useEffect } from "react";
import { TimeEntry } from "../types";

interface UseTimeEntrySelectionReturn {
	selectedEntries: Record<string, boolean>;
	selectAll: boolean;
	toggleEntrySelection: (entryId: string) => void;
	toggleSelectAll: () => void;
	getSelectedEntryIds: () => string[];
	clearSelection: () => void;
}

/**
 * useTimeEntrySelection - Manages selection state for time entries
 *
 * Handles:
 * - Individual entry selection
 * - Select all/deselect all functionality
 * - Getting list of selected entry IDs
 * - Clearing selection
 */
export const useTimeEntrySelection = (
	timeEntries: TimeEntry[],
): UseTimeEntrySelectionReturn => {
	const [selectedEntries, setSelectedEntries] = useState<
		Record<string, boolean>
	>({});
	const [selectAll, setSelectAll] = useState(false);

	// Initialize selection state when entries change
	useEffect(() => {
		const initialSelection: Record<string, boolean> = {};
		timeEntries.forEach((entry) => {
			initialSelection[entry.id] = false;
		});
		setSelectedEntries(initialSelection);
		setSelectAll(false);
	}, [timeEntries]);

	// Toggle selection for a specific entry
	const toggleEntrySelection = useCallback((entryId: string) => {
		setSelectedEntries((prev) => ({
			...prev,
			[entryId]: !prev[entryId],
		}));
	}, []);

	// Toggle select all entries
	const toggleSelectAll = useCallback(() => {
		const newValue = !selectAll;
		setSelectAll(newValue);

		const updatedSelection: Record<string, boolean> = {};
		timeEntries.forEach((entry) => {
			updatedSelection[entry.id] = newValue;
		});
		setSelectedEntries(updatedSelection);
	}, [selectAll, timeEntries]);

	// Get IDs of selected entries
	const getSelectedEntryIds = useCallback(() => {
		return Object.keys(selectedEntries).filter((id) => selectedEntries[id]);
	}, [selectedEntries]);

	// Clear all selections
	const clearSelection = useCallback(() => {
		setSelectAll(false);
		const resetSelection: Record<string, boolean> = {};
		timeEntries.forEach((entry) => {
			resetSelection[entry.id] = false;
		});
		setSelectedEntries(resetSelection);
	}, [timeEntries]);

	return {
		selectedEntries,
		selectAll,
		toggleEntrySelection,
		toggleSelectAll,
		getSelectedEntryIds,
		clearSelection,
	};
};
