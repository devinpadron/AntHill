/*
 * Classifies every date-ish value v1 ever wrote.
 *
 * v1 has seven competing representations, and one of them is a landmine:
 * useEventForm.ts READS with the format "YYYY-MM-DD HH:mm" but WRITES
 * offset-ISO. Moment parses the mismatch leniently and silently produces the
 * wrong time, which is why edit-mode start/end times drift.
 *
 * The classifier never guesses. Anything it cannot place comes back as
 * "unparseable" so the profile can count it rather than a transform silently
 * defaulting it.
 */

const ISO_OFFSET =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?([+-]\d{2}:?\d{2}|Z)$/;
const ISO_NO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_SPACE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
const TIME_ONLY = /^\d{1,2}:\d{2}$/;

/** Sanity window for epoch-millis detection: 2001-09-09 .. 2286-11-20 */
const MIN_MILLIS = 1_000_000_000_000;
const MAX_MILLIS = 9_999_999_999_999;

export const BRANCHES = [
	"empty",
	"timestamp",
	"epochMillis",
	"epochSeconds",
	"dateOnly",
	"isoOffset",
	"isoNoOffset",
	"dateTimeSpace",
	"timeOnly",
	"unparseable",
];

/**
 * @returns {{branch: string, needsTimeZone: boolean}}
 *
 * `needsTimeZone` marks values that cannot be resolved to an instant without
 * knowing the company's zone. If the profile reports zero of these, the whole
 * timezone risk in the migration plan evaporates.
 */
export function classifyTimestamp(value) {
	if (value === null || value === undefined || value === "") {
		return { branch: "empty", needsTimeZone: false };
	}

	// Firestore Timestamp (admin SDK) or a JS Date
	if (typeof value?.toDate === "function" || value instanceof Date) {
		return { branch: "timestamp", needsTimeZone: false };
	}

	if (typeof value === "number") {
		if (value >= MIN_MILLIS && value <= MAX_MILLIS) {
			return { branch: "epochMillis", needsTimeZone: false };
		}
		if (value >= MIN_MILLIS / 1000 && value <= MAX_MILLIS / 1000) {
			return { branch: "epochSeconds", needsTimeZone: false };
		}
		return { branch: "unparseable", needsTimeZone: false };
	}

	if (typeof value !== "string") {
		return { branch: "unparseable", needsTimeZone: false };
	}

	if (DATE_ONLY.test(value)) {
		// A calendar day, not an instant — becomes a dateKey, never a Timestamp.
		return { branch: "dateOnly", needsTimeZone: false };
	}
	if (ISO_OFFSET.test(value)) {
		return { branch: "isoOffset", needsTimeZone: false };
	}
	if (ISO_NO_OFFSET.test(value)) {
		return { branch: "isoNoOffset", needsTimeZone: true };
	}
	if (DATE_TIME_SPACE.test(value)) {
		return { branch: "dateTimeSpace", needsTimeZone: true };
	}
	if (TIME_ONLY.test(value)) {
		// Found only by profiling production: 16 event times stored as a bare
		// time of day. Meaningless without the event's `date` AND a zone.
		return { branch: "timeOnly", needsTimeZone: true };
	}

	return { branch: "unparseable", needsTimeZone: false };
}

/**
 * Milliseconds to add to a UTC instant to express it in `timeZone`.
 * Uses Intl rather than a date library so the transforms stay dependency-free.
 */
function zoneOffsetMillis(date, timeZone) {
	const dtf = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const p = Object.fromEntries(
		dtf.formatToParts(date).map((x) => [x.type, x.value]),
	);
	const asUTC = Date.UTC(
		Number(p.year),
		Number(p.month) - 1,
		Number(p.day),
		Number(p.hour) % 24,
		Number(p.minute),
		Number(p.second),
	);
	return asUTC - date.getTime();
}

/**
 * "2025-06-15" + "17:30" in a zone -> the correct UTC instant.
 *
 * Two passes, because the offset depends on the instant we are trying to find.
 * The second pass is what keeps DST boundaries honest — with one pass, a time
 * near a spring-forward transition lands an hour out.
 */
export function zonedDateTimeToInstant(dateKey, timeOfDay, timeZone) {
	if (!DATE_ONLY.test(dateKey ?? "")) return null;
	const time = /^\d{1,2}:\d{2}$/.test(timeOfDay ?? "")
		? timeOfDay.padStart(5, "0")
		: null;
	if (!time) return null;

	const naive = new Date(`${dateKey}T${time}:00Z`);
	if (Number.isNaN(naive.getTime())) return null;

	let instant = new Date(naive.getTime() - zoneOffsetMillis(naive, timeZone));
	instant = new Date(naive.getTime() - zoneOffsetMillis(instant, timeZone));
	return instant;
}

/**
 * Converts any v1 date-ish value to a Date.
 *
 * NEVER silently defaults. Anything it cannot resolve comes back
 * `{ ok: false }` so the caller records it instead of inventing a time.
 *
 * @param {object} [ctx] `{ dateKey, timeZone }` — required to resolve bare
 *   times of day, which carry no date of their own.
 */
export function toDate(value, ctx = {}) {
	const { branch } = classifyTimestamp(value);

	switch (branch) {
		case "empty":
			return { ok: true, value: null, branch };
		case "timestamp":
			return {
				ok: true,
				value:
					typeof value.toDate === "function" ? value.toDate() : value,
				branch,
			};
		case "epochMillis":
			return { ok: true, value: new Date(value), branch };
		case "epochSeconds":
			return { ok: true, value: new Date(value * 1000), branch };
		case "isoOffset":
			return { ok: true, value: new Date(value), branch };
		case "isoNoOffset":
		case "dateTimeSpace": {
			const [d, t] = value.replace("T", " ").split(" ");
			const instant = zonedDateTimeToInstant(
				d,
				t?.slice(0, 5),
				ctx.timeZone,
			);
			return instant
				? { ok: true, value: instant, branch, assumedTimeZone: true }
				: { ok: false, raw: value, branch };
		}
		case "timeOnly": {
			const instant = zonedDateTimeToInstant(
				ctx.dateKey,
				value,
				ctx.timeZone,
			);
			return instant
				? { ok: true, value: instant, branch, assumedTimeZone: true }
				: { ok: false, raw: value, branch };
		}
		case "dateOnly":
			// A calendar day is not an instant. Callers want dateKey, not this.
			return { ok: false, raw: value, branch };
		default:
			return { ok: false, raw: value, branch };
	}
}

/** The "YYYY-MM-DD" local day for an instant. */
export function toDateKey(date, timeZone) {
	if (!date) return null;
	const dtf = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	return dtf.format(date);
}
