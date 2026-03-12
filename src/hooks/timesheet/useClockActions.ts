import { useState, useCallback } from "react";
import { useUser } from "../../contexts/UserContext";
import {
	clockIn,
	clockOut,
	pauseTimeEntry,
	resumeTimeEntry,
} from "../../services/timeEntryService";

/**
 * useClockActions - Handle clock in/out/pause/resume operations
 *
 * Handles:
 * - Clock in/out operations
 * - Timer pause/resume with loading states
 * - Error handling for all operations
 */
export const useClockActions = () => {
	const { userId, companyId } = useUser();
	const [isPausingOrResuming, setIsPausingOrResuming] = useState(false);

	const handleClockIn = useCallback(async () => {
		try {
			const timeEntry = await clockIn(userId, companyId);
			return timeEntry;
		} catch (error) {
			console.error("Error clocking in:", error);
			throw error;
		}
	}, [userId, companyId]);

	const handleClockOut = useCallback(
		async (activeTimeEntryId: string) => {
			if (!activeTimeEntryId) return;

			try {
				const completedEntry = await clockOut(
					activeTimeEntryId,
					companyId,
				);
				return completedEntry;
			} catch (error) {
				console.error("Error clocking out:", error);
				throw error;
			}
		},
		[companyId],
	);

	const handlePauseTimer = useCallback(
		async (activeTimeEntryId: string) => {
			if (!activeTimeEntryId) return;

			try {
				setIsPausingOrResuming(true);
				await pauseTimeEntry(activeTimeEntryId, companyId);
			} catch (error) {
				console.error("Error pausing timer:", error);
				throw error;
			} finally {
				setIsPausingOrResuming(false);
			}
		},
		[companyId],
	);

	const handleResumeTimer = useCallback(
		async (activeTimeEntryId: string) => {
			if (!activeTimeEntryId) return;

			try {
				setIsPausingOrResuming(true);
				await resumeTimeEntry(activeTimeEntryId, companyId);
			} catch (error) {
				console.error("Error resuming timer:", error);
				throw error;
			} finally {
				setIsPausingOrResuming(false);
			}
		},
		[companyId],
	);

	return {
		isPausingOrResuming,
		clockIn: handleClockIn,
		clockOut: handleClockOut,
		pauseTimer: handlePauseTimer,
		resumeTimer: handleResumeTimer,
	};
};
