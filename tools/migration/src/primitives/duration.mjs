/*
 * v1 had two fields called `duration` with different units AND different types:
 *   Event.duration      a STRING of hours   ("3.50")
 *   TimeEntry.duration  a NUMBER of seconds (12600)
 *
 * v2 has one convention: whole seconds, in a field ending `Seconds`.
 */

/** Hours-as-string -> whole seconds. Returns null when unparseable. */
export function hoursStringToSeconds(value) {
	if (value === null || value === undefined || value === "") return null;
	const hours = parseFloat(value);
	if (!Number.isFinite(hours) || hours < 0) return null;
	return Math.round(hours * 3600);
}

/** Whole seconds between two instants, or null. */
export function secondsBetween(start, end) {
	if (!start || !end) return null;
	const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
	return Number.isFinite(seconds) ? seconds : null;
}

/**
 * Event duration, preferring the computed value.
 *
 * The stored string was maintained by hand alongside start/end and can drift.
 * When both are available and disagree by more than a minute, the computed
 * value wins and the caller is told, so the discrepancy gets reported rather
 * than silently resolved.
 */
export function resolveEventDurationSeconds({
	startAt,
	endAt,
	legacyDuration,
}) {
	const computed = secondsBetween(startAt, endAt);
	const stored = hoursStringToSeconds(legacyDuration);

	if (computed === null) return { seconds: stored, source: "stored" };
	if (stored === null) return { seconds: computed, source: "computed" };

	const disagrees = Math.abs(computed - stored) > 60;
	return {
		seconds: computed,
		source: "computed",
		disagreement: disagrees ? { computed, stored } : undefined,
	};
}
