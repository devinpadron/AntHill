import { useState, useCallback, useEffect } from "react";
import { useUser } from "../../contexts/UserContext";
import { getTimeEntries } from "../../services/timeEntryService";
import { TimeEntry } from "../../types";

interface UseTimeEntriesParams {
	startDate?: Date;
	endDate?: Date;
}

/**
 * useTimeEntries - Fetch and manage time entries for a date range
 *
 * Handles:
 * - Fetching time entries by date range
 * - Loading and error states
 * - Manual refresh capability
 */
export const useTimeEntries = ({
	startDate,
	endDate,
}: UseTimeEntriesParams = {}) => {
	const { userId, companyId } = useUser();
	const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchTimeEntries = useCallback(async () => {
		if (!userId || !companyId) return;

		try {
			setIsLoading(true);
			setError(null);
			const entries = await getTimeEntries(
				userId,
				companyId,
				startDate,
				endDate,
			);
			setTimeEntries(entries);
		} catch (err) {
			console.error("Error fetching time entries:", err);
			setError(
				err instanceof Error
					? err.message
					: "Failed to fetch time entries",
			);
		} finally {
			setIsLoading(false);
		}
	}, [userId, companyId, startDate, endDate]);

	useEffect(() => {
		fetchTimeEntries();
	}, [fetchTimeEntries]);

	return {
		timeEntries,
		isLoading,
		error,
		refetch: fetchTimeEntries,
	};
};
