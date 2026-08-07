import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	clockIn,
	clockOut,
	dateKeyFor,
	getTimeEntries,
	pauseEntry,
	resumeEntry,
	subscribeActiveEntry,
} from "../services/timeEntryService";
import { SnapshotSync, TimeEntry, UNKNOWN_SYNC } from "../types";

/*
 * Clock in / out and the entry list.
 *
 * The active entry is a live subscription; the list is paginated. v1 fetched
 * every matching entry with no bound, and kept `isPaused` in the fetch effect's
 * dependency array, so every pause and resume triggered a full refetch.
 *
 * The clock actions are FIRE AND FORGET. timeEntryService's writes return once
 * the entry is on local disk rather than when the server acknowledges it, which
 * is what lets a worker clock out in a basement. Two consequences here:
 *
 *   - `isBusy` is a tap debounce, nothing more. It used to wrap the awaited
 *     write, so offline it latched true forever and the pause and resume
 *     buttons stayed disabled for the rest of the shift.
 *   - `isSyncing` is the honest signal for "not on the server yet", and it comes
 *     from Firestore's own metadata, so it survives a force-quit. It must drive
 *     an indicator only. Never disable a control on it — being unsynced is the
 *     normal state on a job site.
 */

const PAGE_SIZE = 50;

/**
 * How long a tap locks the clock controls.
 *
 * Long enough to swallow a double tap, short enough to be invisible. The real
 * guard against opening two entries is that `activeEntry` arrives from the
 * cached snapshot within a tick and the buttons switch on that.
 */
const TAP_DEBOUNCE_MS = 400;

export function useTimeTracking(
	companyId: string,
	userId: string,
	timeZone: string,
	/** Optional "YYYY-MM-DD" window, for the week the screen is showing. */
	range?: { from: string; to: string },
) {
	const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
	const [sync, setSync] = useState<SnapshotSync>(UNKNOWN_SYNC);
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
			setSync(UNKNOWN_SYNC);
			return;
		}
		return subscribeActiveEntry(companyId, userId, (entry, nextSync) => {
			setActiveEntry(entry);
			setSync(nextSync);
		});
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

	/*
	 * Swallows a double tap. Not a network gate.
	 *
	 * The flag lives in a ref as well as state: as state alone it was a
	 * dependency of `guard`, which rebuilt `actions` on every flip. It is
	 * cleared on a timer rather than in a `finally`, so it is structurally
	 * incapable of outliving one tap however the action behaves.
	 */
	const busyRef = useRef(false);

	const guard = useCallback((action: () => void) => {
		if (busyRef.current) return;
		busyRef.current = true;
		setIsBusy(true);

		try {
			action();
		} catch (e) {
			// The writes queue locally, so reaching here means a programming
			// error rather than a network one. Surfaced for the screen to toast.
			console.error("Time tracking action failed", e);
			throw e;
		} finally {
			setTimeout(() => {
				busyRef.current = false;
				setIsBusy(false);
			}, TAP_DEBOUNCE_MS);
		}
	}, []);

	const actions = useMemo(
		() => ({
			clockIn: () => guard(() => clockIn(companyId, userId, timeZone)),
			/*
			 * No refetch here. The completed entry reaches the list through the
			 * range query on the next focus, and offline a get() would block on
			 * the SDK's server timeout before falling back to cache.
			 */
			clockOut: () =>
				guard(() => {
					if (activeEntry) clockOut(activeEntry);
				}),
			pause: () =>
				guard(() => {
					if (activeEntry) pauseEntry(activeEntry.id);
				}),
			resume: () =>
				guard(() => {
					if (activeEntry) resumeEntry(activeEntry);
				}),
		}),
		[guard, companyId, userId, timeZone, activeEntry],
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
		/*
		 * There are local changes the server has not acknowledged. Drives an
		 * indicator; must never disable a control — see the note at the top.
		 */
		isSyncing: sync.hasPendingWrites,
		/** Showing cached data. Normal offline, and briefly on every cold start. */
		isFromCache: sync.fromCache,
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
