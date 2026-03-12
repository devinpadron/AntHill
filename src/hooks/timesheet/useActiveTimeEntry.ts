import { useState, useEffect } from "react";
import { useUser } from "../../contexts/UserContext";
import { subscribeToActiveTimeEntry } from "../../services/timeEntryService";
import { TimeEntry } from "../../types";

/**
 * useActiveTimeEntry - Subscribe to the currently active time entry
 *
 * Handles:
 * - Real-time subscription to active time entry
 * - Pause state detection
 * - Automatic cleanup on unmount
 */
export const useActiveTimeEntry = () => {
	const { userId, companyId } = useUser();
	const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(
		null,
	);
	const [isPaused, setIsPaused] = useState(false);

	useEffect(() => {
		if (!userId || !companyId) return;

		const unsubscribe = subscribeToActiveTimeEntry(
			userId,
			companyId,
			(active) => {
				setActiveTimeEntry(active);
				setIsPaused(active?.status === "paused" || false);
			},
		);

		return () => unsubscribe();
	}, [userId, companyId]);

	return {
		activeTimeEntry,
		isClockedIn: !!activeTimeEntry,
		isPaused,
	};
};
