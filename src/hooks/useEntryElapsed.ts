import { useEffect, useMemo, useState } from "react";
import { differenceInSeconds } from "date-fns";

/**
 * Live elapsed time for a time entry.
 *
 * Ticks once a second while the entry is running or paused, and returns the
 * stored total once it is finished — so the same values drive a card in a list
 * and the big timer on the clock.
 *
 * The two clocks move independently: worked time freezes the moment a shift is
 * paused, while the paused total keeps climbing. Reading `workedSeconds` off
 * the wall clock during a pause would silently pay the worker for their break.
 */

type ElapsedEntry = {
	status?: string;
	clockInAt?: { toDate: () => Date };
	/** Seconds banked across pauses ALREADY ended. */
	pausedSeconds?: number;
	/** When the current pause began, if there is one. */
	pauseStartTime?: string | number | Date;
	workedSeconds?: number;
};

export type Elapsed = {
	/** Time on the clock, excluding pauses. */
	workedSeconds: number;
	/** Total time paused, including the pause in progress. */
	pausedSeconds: number;
	/** Running or paused — i.e. the numbers are still moving. */
	isLive: boolean;
	isRunning: boolean;
	isPaused: boolean;
};

export const useEntryElapsed = (entry: ElapsedEntry | null): Elapsed => {
	const isRunning = entry?.status === "active";
	const isPaused = entry?.status === "paused";
	const isLive = isRunning || isPaused;

	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		if (!isLive) return;

		/*
		 * Re-synced from `Date.now()` each tick rather than counting intervals,
		 * so a backgrounded app comes back showing the true elapsed time
		 * instead of however many ticks the OS let through.
		 */
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [isLive]);

	return useMemo(() => {
		const idle = {
			workedSeconds: 0,
			pausedSeconds: 0,
			isLive: false,
			isRunning: false,
			isPaused: false,
		};

		if (!entry?.clockInAt) return idle;

		const start = entry.clockInAt.toDate();
		const banked = entry.pausedSeconds || 0;

		if (isRunning) {
			return {
				workedSeconds: Math.max(
					0,
					differenceInSeconds(new Date(now), start) - banked,
				),
				pausedSeconds: banked,
				isLive: true,
				isRunning: true,
				isPaused: false,
			};
		}

		if (isPaused) {
			const pauseStart = entry.pauseStartTime
				? new Date(entry.pauseStartTime)
				: new Date(now);

			return {
				// Frozen at the moment the pause started.
				workedSeconds: Math.max(
					0,
					differenceInSeconds(pauseStart, start) - banked,
				),
				pausedSeconds:
					banked +
					Math.max(0, differenceInSeconds(new Date(now), pauseStart)),
				isLive: true,
				isRunning: false,
				isPaused: true,
			};
		}

		// Finished: trust what was written, not the wall clock.
		return {
			...idle,
			workedSeconds: entry.workedSeconds || 0,
			pausedSeconds: banked,
		};
	}, [entry, now, isRunning, isPaused]);
};
