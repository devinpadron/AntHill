import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMyEventHistory } from "../services/eventService";
import { dateKeyFor, getAllTimeEntries } from "../services/timeEntryService";
import { Event, TimeEntry } from "../types";
import {
	ALL_TIME,
	availableYears,
	computeStats,
	UserStats,
	YearKey,
} from "../utils/statsUtils";

/*
 * The statistics page's data.
 *
 * Two full-history sweeps, then everything else is arithmetic. The year
 * selector must not touch the network: switching from 2026 to all-time is a
 * recompute over arrays already in memory, which is why the raw documents are
 * held in state rather than a pre-computed summary.
 */

type History = {
	entries: TimeEntry[];
	events: Event[];
	truncated: boolean;
};

const EMPTY: History = { entries: [], events: [], truncated: false };

/*
 * Session cache, keyed by company and user.
 *
 * Statistics are read-only and change at most once a shift, so re-reading two
 * whole collections because someone tapped back and then forward again is pure
 * waste. Deliberately module-level and unbounded: it holds at most one entry
 * per company the signed-in user belongs to, and `refresh` is the escape hatch.
 */
const cache = new Map<string, History>();

export function useUserStats(
	companyId: string,
	userId: string,
	timeZone: string,
) {
	const cacheKey = `${companyId}:${userId}`;
	const [history, setHistory] = useState<History>(
		() => cache.get(cacheKey) ?? EMPTY,
	);
	const [isLoading, setIsLoading] = useState(!cache.has(cacheKey));

	/*
	 * What the hook is currently showing. A sweep takes a few round trips, so a
	 * company swap mid-flight can land results for the company the user just
	 * left. The cache write still happens — that work is not wasted — but the
	 * state write is skipped.
	 */
	const activeKey = useRef(cacheKey);
	useEffect(() => {
		return () => {
			activeKey.current = "";
		};
	}, []);

	const todayKey = useMemo(
		() => dateKeyFor(new Date(), timeZone),
		[timeZone],
	);

	const load = useCallback(async () => {
		if (!companyId || !userId) {
			setHistory(EMPTY);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);

		// In parallel: neither sweep depends on the other, and together they are
		// the whole cost of the screen.
		const [entryResult, eventResult] = await Promise.all([
			getAllTimeEntries(companyId, { userId }),
			getMyEventHistory(companyId, userId, todayKey),
		]);

		const next: History = {
			entries: entryResult.entries,
			events: eventResult.events,
			truncated: entryResult.truncated || eventResult.truncated,
		};

		cache.set(cacheKey, next);
		if (activeKey.current !== cacheKey) return;

		setHistory(next);
		setIsLoading(false);
	}, [companyId, userId, todayKey, cacheKey]);

	useEffect(() => {
		activeKey.current = cacheKey;

		const cached = cache.get(cacheKey);
		if (cached) {
			setHistory(cached);
			setIsLoading(false);
			return;
		}

		load();
	}, [cacheKey, load]);

	/** Drops the cache and re-reads. Wired to pull-to-refresh. */
	const refresh = useCallback(async () => {
		cache.delete(cacheKey);
		await load();
	}, [cacheKey, load]);

	const years = useMemo(
		() => availableYears(history.entries, history.events),
		[history],
	);

	/*
	 * Memoised per year rather than per call: the screen renders one year at a
	 * time, but re-renders often, and recomputing a couple of thousand entries
	 * on every frame of a scroll is exactly the kind of cost that never shows up
	 * on a developer's phone.
	 *
	 * The map comes from useMemo, not a ref cleared in an effect. A ref would
	 * still be holding the previous history's results during the render that
	 * first sees new data — the effect that clears it runs afterwards, and
	 * nothing re-renders, so the stale numbers would simply stay on screen.
	 */
	const statsByYear = useMemo(
		() => new Map<YearKey, UserStats>(),
		[history, timeZone, todayKey],
	);

	const statsFor = useCallback(
		(year: YearKey): UserStats => {
			const hit = statsByYear.get(year);
			if (hit) return hit;

			const computed = computeStats(
				history.entries,
				history.events,
				year,
				timeZone,
				todayKey,
			);
			statsByYear.set(year, computed);
			return computed;
		},
		[statsByYear, history, timeZone, todayKey],
	);

	const hasAnyData = history.entries.length > 0 || history.events.length > 0;

	return {
		years,
		isLoading,
		truncated: history.truncated,
		hasAnyData,
		statsFor,
		refresh,
		allTime: ALL_TIME,
	};
}
