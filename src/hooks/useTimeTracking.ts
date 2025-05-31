import { useEffect, useState, useCallback } from "react";
import { useUser } from "../contexts/UserContext";
import {
	clockIn,
	clockOut,
	pauseTimeEntry,
	resumeTimeEntry,
	getTimeEntries,
	subscribeToActiveTimeEntry,
	getAllTimeEntries,
} from "../services/timeEntryService";
import { startOfWeek, endOfWeek } from "date-fns";
import { TimeEntry } from "../types";
import { useCompany } from "../contexts/CompanyContext";

export const useTimeTracking = () => {
	const { userId, companyId } = useUser();
	const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(
		null,
	);
	const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isPaused, setIsPaused] = useState(false);
	const [isPausingOrResuming, setIsPausingOrResuming] = useState(false);

	const { preferences } = useCompany();

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
				setIsPaused(active?.status === "paused" || false);

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

	// Calculate weekly stats
	const getWeeklyStats = useCallback(() => {
		if (!timeEntries.length)
			return { hours: 0, minutes: 0, seconds: 0, count: 0 };

		const today = new Date();

		// Weekly summary data
		const weekStart =
			preferences.workWeekStarts === "sunday"
				? startOfWeek(new Date(), { weekStartsOn: 0 })
				: startOfWeek(new Date(), { weekStartsOn: 1 });

		const weekEnd =
			preferences.workWeekStarts === "sunday"
				? endOfWeek(new Date(), { weekStartsOn: 0 })
				: endOfWeek(new Date(), { weekStartsOn: 1 });

		const thisWeekEntries = timeEntries.filter((entry) => {
			const entryDate = new Date(entry.clockInTime);
			return entryDate >= weekStart && entryDate <= weekEnd;
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
	}, [timeEntries]);

	// Clock in function
	const handleClockIn = async () => {
		try {
			const timeEntry = await clockIn(userId, companyId);
			fetchTimeEntries();
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
			return completedEntry;
		} catch (error) {
			console.error("Error clocking out:", error);
			throw error;
		}
	};

	// Pause timer function
	const handlePauseTimer = async () => {
		if (!activeTimeEntry || !activeTimeEntry.id) return;

		try {
			setIsPausingOrResuming(true);
			await pauseTimeEntry(activeTimeEntry.id, companyId);
			// Don't need to set isPaused here as the Firestore listener will update it
		} catch (error) {
			console.error("Error pausing timer:", error);
			// Show an alert or toast notification here
			throw error;
		} finally {
			setIsPausingOrResuming(false);
		}
	};

	// Resume timer function
	const handleResumeTimer = async () => {
		if (!activeTimeEntry || !activeTimeEntry.id) return;

		try {
			setIsPausingOrResuming(true);
			await resumeTimeEntry(activeTimeEntry.id, companyId);
			// Don't need to set isPaused here as the Firestore listener will update it
		} catch (error) {
			console.error("Error resuming timer:", error);
			// Show an alert or toast notification here
			throw error;
		} finally {
			setIsPausingOrResuming(false);
		}
	};

	return {
		activeTimeEntry,
		timeEntries,
		isClockedIn: !!activeTimeEntry,
		isLoading,
		isPaused,
		isPausingOrResuming,
		clockIn: handleClockIn,
		clockOut: handleClockOut,
		pauseTimer: handlePauseTimer,
		resumeTimer: handleResumeTimer,
		fetchTimeEntries,
		weeklyStats: getWeeklyStats(),
	};
};
