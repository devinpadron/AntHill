import { useEffect, useState, useCallback } from "react";
import { useUser } from "../contexts/UserContext";
import {
	clockIn,
	clockOut,
	getAllTimeEntries,
	subscribeToActiveTimeEntry,
} from "../services/timeEntryService";
import { startOfWeek, endOfWeek } from "date-fns";
import { TimeEntry } from "../types";

export const useTimeTracking = () => {
	const { userId, companyId } = useUser();
	const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(
		null,
	);
	const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	// Get all time entries for this user
	const fetchTimeEntries = useCallback(async () => {
		if (!userId || !companyId) return;

		setIsLoading(true);
		try {
			// Use the broader getAllTimeEntries function instead of date-range limited one
			const entries = await getAllTimeEntries(userId, companyId);
			setTimeEntries(entries);
		} catch (error) {
			console.error("Error fetching time entries:", error);
		} finally {
			setIsLoading(false);
		}
	}, [userId, companyId]);

	// Check for existing active time entry on load and set up listeners
	useEffect(() => {
		if (!userId || !companyId) return;

		// Initial fetch
		fetchTimeEntries();

		// Set up subscription using the service function
		const unsubscribe = subscribeToActiveTimeEntry(
			userId,
			companyId,
			(active) => {
				// Update active entry state
				setActiveTimeEntry(active);

				// If active status changed, refresh the list
				if (
					(active && !activeTimeEntry) ||
					(!active && activeTimeEntry)
				) {
					fetchTimeEntries();
				}
			},
		);

		// Clean up subscription on unmount
		return () => unsubscribe();
	}, [userId, companyId, fetchTimeEntries]);

	// Clock in function
	const handleClockIn = async () => {
		try {
			const timeEntry = await clockIn(userId, companyId);
			return timeEntry;
		} catch (error) {
			console.error("Error clocking in:", error);
			throw error;
		}
	};

	// Clock out function
	const handleClockOut = async () => {
		if (!activeTimeEntry) return;

		try {
			const completedEntry = await clockOut(
				activeTimeEntry.id,
				companyId,
			);
			fetchTimeEntries(); // Refresh time entries after clocking out
			return completedEntry;
		} catch (error) {
			console.error("Error clocking out:", error);
			throw error;
		}
	};

	// Calculate weekly stats
	const getWeeklyStats = useCallback(() => {
		if (!timeEntries.length) return { hours: 0, minutes: 0, count: 0 };

		const today = new Date();
		const weekStart = startOfWeek(today, { weekStartsOn: 0 });
		const weekEnd = endOfWeek(today, { weekStartsOn: 0 });

		const thisWeekEntries = timeEntries.filter((entry) => {
			const entryDate = new Date(entry.clockInTime);
			return entryDate >= weekStart && entryDate <= weekEnd;
		});

		const totalMinutes = thisWeekEntries.reduce(
			(sum, entry) => sum + (entry.duration || 0),
			0,
		);

		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;

		return { hours, minutes, count: thisWeekEntries.length };
	}, [timeEntries]);

	return {
		activeTimeEntry,
		timeEntries,
		isClockedIn: !!activeTimeEntry,
		isLoading,
		clockIn: handleClockIn,
		clockOut: handleClockOut,
		fetchTimeEntries,
		weeklyStats: getWeeklyStats(),
	};
};
