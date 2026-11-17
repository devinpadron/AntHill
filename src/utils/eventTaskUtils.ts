import {
	ReminderSchedule,
	TaskAnchor,
	TaskAssigneeMode,
	TaskReminderRule,
} from "../types";

/*
 * The arithmetic behind event tasks, with no Firestore in it.
 *
 * Everything here works in epoch milliseconds and plain values so the same
 * functions serve the service (which converts Timestamps at its edge), both
 * clients' editors, and the scheduled Cloud Function — whose copy of
 * `computeNextReminderMs` must stay identical to this one. See the event tasks
 * section of CLOUD_FUNCTIONS_HANDOFF.md.
 */

/**
 * How long after an event's end a task can still be chased.
 *
 * Tasks legitimately fall due AFTER an event ("return the van keys"), so the
 * cut-off cannot be the event itself — but a reminder about a job from last
 * month is noise nobody acts on.
 */
export const TASK_EXPIRY_SECONDS = 7 * 24 * 3600;

/*
 * An all-day event has no start or end instant, and reminders need one.
 *
 * A working day rather than midnight to midnight: "2 hours after it ends"
 * measured from midnight is a push at 2 a.m.
 */
export const ALL_DAY_START_HOUR = 9;
export const ALL_DAY_END_HOUR = 17;

/** Most rules one template may carry. The editors enforce it. */
export const MAX_REMINDER_RULES = 3;

const dayAt = (dateKey: string, hour: number): number => {
	const [year, month, day] = dateKey.split("-").map(Number);
	// Local time on that calendar day — never parsed as UTC, which would move
	// the day for everyone west of Greenwich.
	return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
};

/**
 * The instants "event start" and "event end" resolve to.
 *
 * An event with a start but no end time ends when it starts: there is nothing
 * better to measure from, and inventing a duration would schedule reminders
 * against a time nobody chose.
 */
export function resolveAnchors(event: {
	dateKey: string;
	startAt: Date | null;
	endAt: Date | null;
}): { startMs: number; endMs: number } {
	if (!event.startAt) {
		return {
			startMs: dayAt(event.dateKey, ALL_DAY_START_HOUR),
			endMs: dayAt(event.dateKey, ALL_DAY_END_HOUR),
		};
	}
	const startMs = event.startAt.getTime();
	return { startMs, endMs: event.endAt ? event.endAt.getTime() : startMs };
}

export const anchorMs = (
	anchor: TaskAnchor,
	anchors: { startMs: number; endMs: number },
): number => (anchor === "eventEnd" ? anchors.endMs : anchors.startMs);

/** Zero when the schedule is off or unconfigured — i.e. "does not repeat". */
export function repeatGapSeconds(
	repeat: ReminderSchedule | undefined | null,
): number {
	if (!repeat?.enabled) return 0;
	return Math.max(0, (repeat.hours ?? 0) * 3600 + (repeat.minutes ?? 0) * 60);
}

/**
 * Who is responsible for a task on a given event.
 *
 * `specific` deliberately does NOT intersect with the crew: the person making
 * the client call is often the manager, who is not working the job.
 */
export function resolveAssignees(
	mode: TaskAssigneeMode,
	crewUserIds: string[],
	namedUserIds: string[] | undefined,
): string[] {
	const source = mode === "specific" ? (namedUserIds ?? []) : crewUserIds;
	return [...new Set((source ?? []).filter(Boolean))];
}

/**
 * Who still owes it.
 *
 * `anyone` is settled by the first completion from ANYBODY — including a
 * manager who is not an assignee ticking it from the office.
 */
export function pendingFor(
	mode: TaskAssigneeMode,
	assigneeUserIds: string[],
	completions: Record<string, unknown> | undefined | null,
): string[] {
	const done = completions ?? {};
	if (mode === "anyone") {
		return Object.keys(done).length > 0 ? [] : [...assigneeUserIds];
	}
	return assigneeUserIds.filter((id) => !(id in done));
}

/**
 * When the next reminder should go out, or null for never.
 *
 * Per rule:
 *   - not yet fired (nothing sent since its first time): its first time, or
 *     NOW if that has already passed. A task attached late — an event created
 *     the day before with a "2 days before" rule — still gets its reminder at
 *     the next pass rather than silently never.
 *   - fired and repeating: one gap after the last send.
 *   - fired and not repeating: spent.
 *
 * The earliest candidate across rules wins. `lastRemindedMs` is one value for
 * the whole task, not per rule, so two rules that fall due together produce
 * one push, not two — a worker is reminded about the task, not about the rule.
 *
 * THE CLOUD FUNCTION RUNS THIS SAME FUNCTION after each send to advance
 * `nextReminderAt`. Change one and the other must follow.
 */
export function computeNextReminderMs(input: {
	rules: TaskReminderRule[];
	startMs: number;
	endMs: number;
	lastRemindedMs: number | null;
	nowMs: number;
	expiresMs: number;
	hasPending: boolean;
}): number | null {
	if (!input.hasPending) return null;

	let best: number | null = null;

	for (const rule of input.rules ?? []) {
		const first = anchorMs(rule.anchor, input) + rule.offsetSeconds * 1000;
		const gap = repeatGapSeconds(rule.repeat) * 1000;

		let candidate: number;
		if (input.lastRemindedMs === null || input.lastRemindedMs < first) {
			candidate = Math.max(first, input.nowMs);
		} else if (gap > 0) {
			candidate = Math.max(input.lastRemindedMs + gap, input.nowMs);
		} else {
			continue;
		}

		if (candidate > input.expiresMs) continue;
		if (best === null || candidate < best) best = candidate;
	}

	return best;
}

/* ------------------------------------------------------------ editor glue */
/**
 * When managers should next hear about a task, or null for never.
 *
 * ONE clock — `overdueAlertAt` — carries up to three kinds of send, in order:
 *
 *   the warning   `warningSeconds` BEFORE the due time: "this is due soon and
 *                 nobody has done it". Skipped once the due time has passed —
 *                 a warning about a deadline already missed is just the
 *                 overdue alert with the wrong words.
 *   the alert     `alertSeconds` AFTER the due time.
 *   its repeats   one `repeatSeconds` gap after the last send, until done.
 *
 * `alertedMs` is the most recent send of ANY of them. That is enough to know
 * where in the sequence the task is: nothing sent means start at the top; a
 * send earlier than the first overdue alert means that alert is still owed
 * (the warning went out, or went out late after quiet hours); anything later
 * means only repeats are left.
 *
 * THE CLOUD FUNCTION RUNS THIS SAME FUNCTION after each send, passing the send
 * time as `alertedMs`, to move `overdueAlertAt` on. Change one and the other
 * must follow.
 */
export function computeNextManagerAlertMs(input: {
	dueMs: number;
	/** How long before due to warn. Null, absent or zero means no warning. */
	warningSeconds: number | null | undefined;
	/** How long after due to alert. Null or absent means no alert. */
	alertSeconds: number | null | undefined;
	repeatSeconds: number | null | undefined;
	alertedMs: number | null;
	nowMs: number;
	expiresMs: number;
	hasPending: boolean;
}): number | null {
	if (!input.hasPending) return null;

	const warningSeconds = Math.max(0, input.warningSeconds || 0);
	const repeatSeconds = Math.max(0, input.repeatSeconds || 0);
	const alertOn =
		input.alertSeconds !== null && input.alertSeconds !== undefined;
	const firstAlertMs = alertOn
		? input.dueMs + Math.max(0, input.alertSeconds || 0) * 1000
		: null;

	let nextMs: number | null;
	if (input.alertedMs === null) {
		nextMs =
			warningSeconds > 0 && input.nowMs < input.dueMs
				? input.dueMs - warningSeconds * 1000
				: firstAlertMs;
	} else if (firstAlertMs !== null && input.alertedMs < firstAlertMs) {
		nextMs = firstAlertMs;
	} else {
		nextMs =
			alertOn && repeatSeconds > 0
				? input.alertedMs + repeatSeconds * 1000
				: null;
	}

	// Anything that could only fire after expiry is not scheduled at all.
	return nextMs !== null && nextMs <= input.expiresMs ? nextMs : null;
}

/*
 * Offsets are edited as "N hours|days before|after" — never minutes. The
 * scheduler runs hourly, so a finer setting would promise precision it cannot
 * deliver.
 */
export type OffsetUnit = "hours" | "days";
export type OffsetDirection = "before" | "after";

export type OffsetParts = {
	amount: number;
	unit: OffsetUnit;
	direction: OffsetDirection;
};

const UNIT_SECONDS: Record<OffsetUnit, number> = {
	hours: 3600,
	days: 86400,
};

export function offsetToParts(offsetSeconds: number): OffsetParts {
	const abs = Math.abs(offsetSeconds);
	const direction: OffsetDirection = offsetSeconds < 0 ? "before" : "after";
	// Days only when it divides evenly; 36 hours stays 36 hours.
	if (abs > 0 && abs % 86400 === 0) {
		return { amount: abs / 86400, unit: "days", direction };
	}
	return { amount: Math.round(abs / 3600), unit: "hours", direction };
}

export function partsToOffset(parts: OffsetParts): number {
	const seconds =
		Math.max(0, Math.round(parts.amount)) * UNIT_SECONDS[parts.unit];
	return parts.direction === "before" ? -seconds : seconds;
}

const ANCHOR_WORD: Record<TaskAnchor, string> = {
	eventStart: "the event starts",
	eventEnd: "the event ends",
};

const plural = (n: number, word: string) =>
	`${n} ${n === 1 ? word : `${word}s`}`;

/** "2 days before the event starts", "when the event ends". */
export function describeOffset(
	anchor: TaskAnchor,
	offsetSeconds: number,
): string {
	if (offsetSeconds === 0) return `when ${ANCHOR_WORD[anchor]}`;
	const { amount, unit, direction } = offsetToParts(offsetSeconds);
	return `${plural(amount, unit === "days" ? "day" : "hour")} ${direction} ${ANCHOR_WORD[anchor]}`;
}

/** "2 days before the event starts, then every 4 hours until done". */
export function describeReminderRule(rule: TaskReminderRule): string {
	const first = describeOffset(rule.anchor, rule.offsetSeconds);
	const gap = repeatGapSeconds(rule.repeat);
	if (!gap) return `${first}, once`;
	const hours = Math.round(gap / 3600);
	return `${first}, then every ${plural(hours, "hour")} until done`;
}

export const ASSIGNEE_MODE_LABEL: Record<TaskAssigneeMode, string> = {
	anyone: "Anyone on the crew",
	everyone: "Everyone on the crew",
	specific: "Specific people",
};

export const ASSIGNEE_MODE_HINT: Record<TaskAssigneeMode, string> = {
	anyone: "One person doing it settles it for the whole crew.",
	everyone: "Each person on the crew confirms for themselves.",
	specific: "You pick who on each event. They need not be on the crew.",
};

export const newReminderRule = (): TaskReminderRule => ({
	id: `r_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
	anchor: "eventStart",
	offsetSeconds: -24 * 3600,
	repeat: { enabled: false, hours: 0, minutes: 0 },
});
