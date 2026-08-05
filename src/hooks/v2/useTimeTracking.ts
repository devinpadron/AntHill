import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	clockIn,
	clockOut,
	dateKeyFor,
	getTimeEntries,
	pauseEntry,
	resumeEntry,
	subscribeActiveEntry,
} from "../../services/v2/timeEntryService";
import { TimeEntry } from "../../types/v2";

/*
 * Clock in / out and the entry list.
 *
 * The active entry is a live subscription; the list is paginated. v1 fetched
 * every matching entry with no bound, and kept `isPaused` in the fetch effect's
 * dependency array, so every pause and resume triggered a full refetch.
 */

const PAGE_SIZE = 50;

export function useTimeTracking(
	companyId: string,
	userId: string,
	timeZone: string,
	/** Optional "YYYY-MM-DD" window, for the week the screen is showing. */
	range?: { from: string; to: string },
) {
	const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
	const [entries, setEntries] = useState<TimeEntry[]>([]);
	/*
	 * The paging cursor lives in a ref, not state.
	 *
	 * As state it was both a dependency of loadPage AND set by it, so every
	 * page load produced a new loadPage — and therefore a new `refresh` — which
	 * the screen's useFocusEffect depended on. Focus effect fires, sets state,
	 * re-renders, new identity, fires again: an infinite render loop.
	 */
	const cursorRef = useRef<unknown>(null);
	const [hasMore, setHasMore] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isBusy, setIsBusy] = useState(false);

	// Live, so a clock-out on another device is reflected here. Deliberately
	// NOT dependent on the paused state.
	useEffect(() => {
		if (!companyId || !userId) {
			setActiveEntry(null);
			return;
		}
		return subscribeActiveEntry(companyId, userId, setActiveEntry);
	}, [companyId, userId]);

	const loadPage = useCallback(
		async (reset: boolean) => {
			if (!companyId || !userId) return;
			setIsLoading(true);

			const result = await getTimeEntries(companyId, {
				userId,
				from: range?.from,
				to: range?.to,
				limit: PAGE_SIZE,
				startAfter: reset ? undefined : (cursorRef.current as never),
			});

			setEntries((prev) =>
				reset ? result.entries : [...prev, ...result.entries],
			);
			cursorRef.current = result.cursor;
			setHasMore(result.cursor !== null);
			setIsLoading(false);
		},
		[companyId, userId, range?.from, range?.to],
	);

	useEffect(() => {
		loadPage(true);
		// Keyed on identity and the window; paging state must not retrigger.
	}, [companyId, userId, range?.from, range?.to]);

	/** Serializes clock actions so a double tap cannot open two entries. */
	const guard = useCallback(
		async (action: () => Promise<unknown>) => {
			if (isBusy) return;
			setIsBusy(true);
			try {
				await action();
			} catch (e) {
				console.error("Time tracking action failed", e);
				throw e;
			} finally {
				setIsBusy(false);
			}
		},
		[isBusy],
	);

	const actions = useMemo(
		() => ({
			clockIn: () => guard(() => clockIn(companyId, userId, timeZone)),
			clockOut: () =>
				guard(async () => {
					if (activeEntry) await clockOut(activeEntry.id);
					await loadPage(true);
				}),
			pause: () =>
				guard(() =>
					activeEntry
						? pauseEntry(activeEntry.id)
						: Promise.resolve(),
				),
			resume: () =>
				guard(() =>
					activeEntry
						? resumeEntry(activeEntry.id)
						: Promise.resolve(),
				),
		}),
		[guard, companyId, userId, timeZone, activeEntry, loadPage],
	);

	const isPaused = activeEntry?.status === "paused";
	const isActive = activeEntry?.status === "active";

	/** Seconds worked so far on the open entry, excluding pauses. */
	const elapsedSeconds = useMemo(() => {
		if (!activeEntry?.clockInAt) return 0;
		const since = Math.round(
			(Date.now() - activeEntry.clockInAt.toMillis()) / 1000,
		);
		const openPause = activeEntry.pauseStartedAt
			? Math.round(
					(Date.now() - activeEntry.pauseStartedAt.toMillis()) / 1000,
				)
			: 0;
		return Math.max(
			0,
			since - (activeEntry.pausedSeconds ?? 0) - openPause,
		);
	}, [activeEntry]);

	/*
	 * Totals for the loaded window.
	 *
	 * The query is already bounded to the range, so this sums what was fetched
	 * rather than re-filtering by date the way v1 did.
	 */
	const weeklyStats = useMemo(() => {
		const totalSeconds = entries.reduce(
			(sum, entry) => sum + (entry.workedSeconds || 0),
			0,
		);
		return {
			hours: Math.floor(totalSeconds / 3600),
			minutes: Math.floor((totalSeconds % 3600) / 60),
			seconds: totalSeconds % 60,
			count: entries.length,
		};
	}, [entries]);

	// Stable identities: screens put these in effect dependency arrays.
	const refresh = useCallback(() => loadPage(true), [loadPage]);
	const loadMore = useCallback(() => loadPage(false), [loadPage]);

	const todayKey = dateKeyFor(new Date(), timeZone);

	return {
		activeEntry,
		entries,
		isActive,
		isPaused,
		isBusy,
		isLoading,
		elapsedSeconds,
		weeklyStats,
		todayKey,
		hasMore,
		loadMore,
		refresh,
		...actions,
	};
}
