import { useMemo } from "react";
import { TimeEntry } from "../../types";

interface UseWeeklySummaryParams {
	timeEntries: TimeEntry[];
	startDate?: Date;
	endDate?: Date;
}

/**
 * useWeeklySummary - Calculate weekly time tracking statistics
 *
 * Calculates:
 * - Total hours, minutes, seconds worked
 * - Number of shifts/entries in the date range
 */
export const useWeeklySummary = ({
	timeEntries,
	startDate,
	endDate,
}: UseWeeklySummaryParams) => {
	const weeklyStats = useMemo(() => {
		if (!timeEntries.length || !startDate || !endDate) {
			return { hours: 0, minutes: 0, seconds: 0, count: 0 };
		}

		const thisWeekEntries = timeEntries.filter((entry) => {
			const entryDate = new Date(entry.clockInTime);
			return entryDate >= startDate && entryDate <= endDate;
		});

		// Total seconds across all entries
		const totalSeconds = thisWeekEntries.reduce(
			(sum, entry) => sum + (entry.duration || 0),
			0,
		);

		// Convert total seconds to hours, minutes, seconds
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		return { hours, minutes, seconds, count: thisWeekEntries.length };
	}, [timeEntries, startDate, endDate]);

	return weeklyStats;
};
