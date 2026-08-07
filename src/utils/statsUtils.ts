import { differenceInCalendarDays, parseISO } from "date-fns";
import { Event, TimeEntry } from "../types";

/*
 * The statistics page's arithmetic.
 *
 * Pure on purpose, like `calculateFieldTotals` in timeUtils: it takes arrays
 * that a service already fetched and returns plain numbers. No Firestore, no
 * hooks, nothing to mock — which matters because a wrong total here is invisible
 * (nobody double-checks "you worked 412 hours"), so it has to be the kind of
 * code you can read and believe.
 *
 * Grouping is by `dateKey.slice(0, 4)`. `dateKey` is already the company-local
 * calendar day, so a year bucket needs no timezone maths at all — only the
 * time-of-day records do, and they say so.
 */

/** A calendar year as a string, or every year at once. */
export type YearKey = string;
export const ALL_TIME = "all";

/** Statuses that count toward hours. */
const isCounted = (entry: TimeEntry) =>
	entry.workedSeconds != null && entry.status !== "rejected";

const yearOf = (dateKey: string) => dateKey.slice(0, 4);

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

const WEEKDAYS = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export type ShiftRecord = {
	entryId: string;
	seconds: number;
	dateKey: string;
};

export type ClockRecord = {
	/** Minutes past local midnight, for display. */
	minutesOfDay: number;
	dateKey: string;
};

export type StreakRecord = {
	days: number;
	fromDateKey: string;
	toDateKey: string;
};

export type EventRecord = {
	eventId: string;
	title: string;
	dateKey: string;
	/** Whichever number the record is about — crew size or seconds. */
	value: number;
};

export type CountRecord = {
	label: string;
	count: number;
};

export type UserStats = {
	// Hours
	totalSeconds: number;
	shiftCount: number;
	daysWorked: number;
	averageShiftSeconds: number | null;
	totalPausedSeconds: number;
	/** Total hours expressed as 24-hour days, for the "you worked N days straight" line. */
	equivalentFullDays: number;

	// Records
	longestShift: ShiftRecord | null;
	shortestShift: ShiftRecord | null;
	longestStreak: StreakRecord | null;
	currentStreak: number;
	firstShiftDateKey: string | null;

	// Rhythm
	busiestMonth: CountRecord | null;
	busiestWeekday: CountRecord | null;
	earliestStart: ClockRecord | null;
	latestFinish: ClockRecord | null;

	// Events
	eventsWorked: number;
	biggestCrew: EventRecord | null;
	longestEvent: EventRecord | null;
	topVenue: CountRecord | null;
	busiestEventMonth: CountRecord | null;
};

/** Years that have any data, newest first. */
export function availableYears(
	entries: TimeEntry[],
	events: Event[],
): string[] {
	const years = new Set<string>();

	for (const entry of entries) {
		if (isCounted(entry) && entry.dateKey) years.add(yearOf(entry.dateKey));
	}
	for (const event of events) {
		if (event.dateKey) years.add(yearOf(event.dateKey));
	}

	return [...years].sort().reverse();
}

/**
 * Minutes past midnight in the company's zone.
 *
 * The same `Intl` approach `dateKeyFor` uses in timeEntryService, and for the
 * same reason: a Timestamp is an instant, and "what time did you start" is a
 * question about the wall clock where the shift happened, not where the phone
 * currently is. `hourCycle: "h23"` rather than `hour12: false`, which some
 * engines still render as "24" for midnight.
 */
function minutesOfDay(date: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		hour: "2-digit",
		minute: "2-digit",
	}).formatToParts(date);

	const value = (type: string) =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);

	return value("hour") * 60 + value("minute");
}

/**
 * How "late" a finish is, for ranking only.
 *
 * A shift that ends at 3:42 AM is the latest anyone finished, not the earliest.
 * Anything before 05:00 is therefore treated as belonging to the previous
 * night. The displayed time is untouched — this only orders them.
 */
const LATE_NIGHT_CUTOFF_MINUTES = 5 * 60;
const lateness = (minutes: number) =>
	minutes < LATE_NIGHT_CUTOFF_MINUTES ? minutes + 24 * 60 : minutes;

/** The longest run of consecutive calendar days present in the set. */
function longestRun(dateKeys: string[]): StreakRecord | null {
	if (!dateKeys.length) return null;

	const days = [...new Set(dateKeys)].sort();

	let best: StreakRecord = {
		days: 1,
		fromDateKey: days[0],
		toDateKey: days[0],
	};
	let runStart = days[0];
	let runLength = 1;

	for (let i = 1; i < days.length; i++) {
		const consecutive =
			differenceInCalendarDays(
				parseISO(days[i]),
				parseISO(days[i - 1]),
			) === 1;

		if (consecutive) {
			runLength += 1;
		} else {
			runStart = days[i];
			runLength = 1;
		}

		if (runLength > best.days) {
			best = {
				days: runLength,
				fromDateKey: runStart,
				toDateKey: days[i],
			};
		}
	}

	return best;
}

/**
 * The run ending today or yesterday.
 *
 * Yesterday counts because someone who worked last night and has not clocked in
 * yet today has not broken anything — telling them their streak died at 9am
 * would be both wrong and dispiriting.
 */
function runEndingNow(dateKeys: string[], todayKey: string): number {
	/*
	 * Future days are dropped first, not just ignored.
	 *
	 * A dateKey after today is rare but real — an admin correcting an entry, or
	 * a company zone ahead of the device's. Walking back from one of those found
	 * no neighbour and reported a streak of 1, silently replacing a genuine
	 * five-day run. `dateKey` sorts lexicographically, so a string compare is
	 * the whole test.
	 */
	const days = [...new Set(dateKeys)]
		.filter((day) => day <= todayKey)
		.sort()
		.reverse();
	if (!days.length) return 0;

	const gap = differenceInCalendarDays(parseISO(todayKey), parseISO(days[0]));
	if (gap > 1) return 0;

	let length = 1;
	for (let i = 1; i < days.length; i++) {
		if (
			differenceInCalendarDays(
				parseISO(days[i - 1]),
				parseISO(days[i]),
			) !== 1
		) {
			break;
		}
		length += 1;
	}

	return length;
}

/** The most frequent key in a tally, or null when the tally is empty. */
function topOf(counts: Map<string, number>): CountRecord | null {
	let best: CountRecord | null = null;

	for (const [label, count] of counts) {
		if (best === null || count > best.count) best = { label, count };
	}

	return best;
}

export function computeStats(
	entries: TimeEntry[],
	events: Event[],
	year: YearKey,
	timeZone: string,
	todayKey: string,
): UserStats {
	const inYear = (dateKey: string) =>
		year === ALL_TIME || yearOf(dateKey) === year;

	const worked = entries.filter(
		(entry) => isCounted(entry) && entry.dateKey && inYear(entry.dateKey),
	);
	const pastEvents = events.filter(
		(event) => event.dateKey && inYear(event.dateKey),
	);

	let totalSeconds = 0;
	let totalPausedSeconds = 0;
	let longestShift: ShiftRecord | null = null;
	let shortestShift: ShiftRecord | null = null;
	let earliestStart: ClockRecord | null = null;
	let latestFinish: ClockRecord | null = null;

	const monthCounts = new Map<string, number>();
	const weekdayCounts = new Map<string, number>();
	const workedDays: string[] = [];

	for (const entry of worked) {
		const seconds = entry.workedSeconds ?? 0;
		totalSeconds += seconds;
		totalPausedSeconds += entry.pausedSeconds ?? 0;
		workedDays.push(entry.dateKey);

		if (!longestShift || seconds > longestShift.seconds) {
			longestShift = {
				entryId: entry.id,
				seconds,
				dateKey: entry.dateKey,
			};
		}
		/*
		 * A zero-second shift is a mis-tap, not a record. Without this floor the
		 * "shortest shift" is almost always someone who clocked in and straight
		 * back out, which tells nobody anything.
		 */
		if (
			seconds > 60 &&
			(!shortestShift || seconds < shortestShift.seconds)
		) {
			shortestShift = {
				entryId: entry.id,
				seconds,
				dateKey: entry.dateKey,
			};
		}

		const parsed = parseISO(entry.dateKey);
		const month = MONTHS[parsed.getMonth()];
		const weekday = WEEKDAYS[parsed.getDay()];
		monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
		weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);

		if (entry.clockInAt) {
			const minutes = minutesOfDay(entry.clockInAt.toDate(), timeZone);
			if (!earliestStart || minutes < earliestStart.minutesOfDay) {
				earliestStart = {
					minutesOfDay: minutes,
					dateKey: entry.dateKey,
				};
			}
		}
		if (entry.clockOutAt) {
			const minutes = minutesOfDay(entry.clockOutAt.toDate(), timeZone);
			if (
				!latestFinish ||
				lateness(minutes) > lateness(latestFinish.minutesOfDay)
			) {
				latestFinish = {
					minutesOfDay: minutes,
					dateKey: entry.dateKey,
				};
			}
		}
	}

	let biggestCrew: EventRecord | null = null;
	let longestEvent: EventRecord | null = null;
	const venueCounts = new Map<string, number>();
	const eventMonthCounts = new Map<string, number>();

	for (const event of pastEvents) {
		const crew = event.assignedCount ?? event.assignedUserIds?.length ?? 0;
		if (crew > 1 && (!biggestCrew || crew > biggestCrew.value)) {
			biggestCrew = {
				eventId: event.id,
				title: event.title,
				dateKey: event.dateKey,
				value: crew,
			};
		}

		const duration = event.durationSeconds ?? 0;
		if (duration > 0 && (!longestEvent || duration > longestEvent.value)) {
			longestEvent = {
				eventId: event.id,
				title: event.title,
				dateKey: event.dateKey,
				value: duration,
			};
		}

		Object.values(event.locations ?? {}).forEach((location) => {
			const label = location?.label?.trim();
			if (label)
				venueCounts.set(label, (venueCounts.get(label) ?? 0) + 1);
		});

		const month = MONTHS[parseISO(event.dateKey).getMonth()];
		eventMonthCounts.set(month, (eventMonthCounts.get(month) ?? 0) + 1);
	}

	const daysWorked = new Set(workedDays).size;
	const allWorkedDays = entries
		.filter((entry) => isCounted(entry) && entry.dateKey)
		.map((entry) => entry.dateKey);

	return {
		totalSeconds,
		shiftCount: worked.length,
		daysWorked,
		averageShiftSeconds: worked.length
			? Math.round(totalSeconds / worked.length)
			: null,
		totalPausedSeconds,
		equivalentFullDays: totalSeconds / 86400,

		longestShift,
		shortestShift,
		longestStreak: longestRun(workedDays),
		/*
		 * Deliberately measured over the WHOLE history, not the selected year: a
		 * streak running across New Year is still a streak, and truncating it at
		 * the year boundary would quietly reset everyone's every January.
		 */
		currentStreak: runEndingNow(allWorkedDays, todayKey),
		firstShiftDateKey: workedDays.length ? [...workedDays].sort()[0] : null,

		busiestMonth: topOf(monthCounts),
		busiestWeekday: topOf(weekdayCounts),
		earliestStart,
		latestFinish,

		eventsWorked: pastEvents.length,
		biggestCrew,
		longestEvent,
		topVenue: topOf(venueCounts),
		busiestEventMonth: topOf(eventMonthCounts),
	};
}

/** "3:42 AM" from minutes past midnight. */
export function formatClock(minutesOfDay: number): string {
	const hour24 = Math.floor(minutesOfDay / 60) % 24;
	const minute = minutesOfDay % 60;
	const suffix = hour24 < 12 ? "AM" : "PM";
	const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

	return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** "Jun 14, 2026" from a dateKey, without dragging in a formatter. */
export function formatDateKey(dateKey: string, withYear = true): string {
	const date = parseISO(dateKey);
	const month = MONTHS[date.getMonth()].slice(0, 3);

	return withYear
		? `${month} ${date.getDate()}, ${date.getFullYear()}`
		: `${month} ${date.getDate()}`;
}
