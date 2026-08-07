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
 *
 * That freeze did not actually work. This read `entry.pauseStartTime`, a name
 * from the old schema that nothing has ever written — the field is
 * `pauseStartedAt`. It was always undefined, so the pause start fell back to
 * "now" on every tick: worked time kept climbing through the break and the
 * paused total never moved. It drives the big timer on the clock screen and
 * every card in the list, so both were wrong for every paused shift.
 *
 * check-layering.sh rule 4 catches exactly this class of mistake and did not
 * list this name. It does now.
 */

type ElapsedEntry = {
	status?: string;
	clockInAt?: { toDate: () => Date };
	/** Seconds banked across pauses ALREADY ended. */
	pausedSeconds?: number;
	/** When the current pause began, if there is one. A Firestore Timestamp. */
	pauseStartedAt?: { toDate: () => Date } | null;
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
			/*
			 * .toDate(), never `new Date(timestamp)` — that yields an Invalid
			 * Date that only throws somewhere else entirely, which is what
			 * check-layering.sh rule 5 exists to prevent.
			 */
			const pauseStart = entry.pauseStartedAt
				? entry.pauseStartedAt.toDate()
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
