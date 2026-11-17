import { BaseDoc, CompanyScoped, DateKey, Timestamp } from "./common";
import { ReminderSchedule } from "./identity";

/*
 * Event tasks: things a manager needs someone on an event to DO and confirm —
 * "final call with the client", "photo of the finished setup", "return the van
 * keys" — with a due time and reminders until it is done.
 *
 * NOT checklists, deliberately. eventChecklistStates is one shared tri-state
 * map that any member ticks, with no record of who or when and no due time, and
 * a scheduler cannot query inside a nested map to find out who still owes what.
 * A task is one flat document per (event, template), which is what makes "who
 * is still pending, and when is the next reminder" a single bounded query.
 */

/**
 * Who has to do it.
 *
 *   anyone    one person on the crew doing it settles it for everybody —
 *             "someone call the client".
 *   everyone  each person on the crew answers for themselves — "confirm you
 *             have your uniform".
 *   specific  the people a manager names on that event, each for themselves.
 *             They need not be on the crew: the manager making the client call
 *             is often not working the job.
 */
export type TaskAssigneeMode = "anyone" | "everyone" | "specific";

/** What a due time or a reminder is measured from. */
export type TaskAnchor = "eventStart" | "eventEnd";

/**
 * One reminder rule.
 *
 * RELATIVE to the event, never a clock time, so one template serves every event
 * it is attached to: "2 days before it starts" is the same rule whether the
 * wedding is in June or October.
 */
export interface TaskReminderRule {
	id: string;
	anchor: TaskAnchor;
	/** When the first reminder goes out. Negative means before the anchor. */
	offsetSeconds: number;
	/**
	 * The gap between repeats until the task is done. Disabled or zero means
	 * the rule fires once — same reading as every other ReminderSchedule, where
	 * zero is "unconfigured", never "on every scheduler pass".
	 */
	repeat: ReminderSchedule;
}

/** taskTemplates/{templateId} — the company's library, like checklists. */
export interface TaskTemplate extends BaseDoc, CompanyScoped {
	title: string;
	description: string;
	assigneeMode: TaskAssigneeMode;
	dueAnchor: TaskAnchor;
	/** Negative means before the anchor. */
	dueOffsetSeconds: number;
	/** The worker must write something when ticking — "what did they say". */
	requireNote: boolean;
	reminders: TaskReminderRule[];
	/**
	 * Warn managers this long BEFORE the due time if nobody has done it yet —
	 * while there is still time to act. Null, zero or absent means no warning.
	 * Independent of the overdue alert below; goes to the same people.
	 */
	dueWarningSeconds?: number | null;
	/**
	 * Tell managers when the task is still open this long after it was due.
	 * Null means never.
	 */
	overdueAlertSeconds: number | null;
	/**
	 * Tell them AGAIN this often while it stays open. Null or zero means the
	 * alert is sent once. Absent on templates saved before this existed.
	 */
	overdueAlertRepeatSeconds?: number | null;
	/**
	 * Which managers get the alert. EMPTY MEANS ALL OF THEM — both the default
	 * and what every template saved before this existed reads as, so nobody
	 * stops hearing about overdue tasks because a field was added. The
	 * scheduler only ever sends to people who are still active managers or
	 * owners, whatever is named here.
	 */
	overdueAlertUserIds?: string[];
}

export interface TaskCompletion {
	completedAt: Timestamp;
	/**
	 * Differs from the map key when a manager ticked it on someone's behalf.
	 * Kept so "Sam did it" and "the office marked it done for Sam" stay
	 * distinguishable after the fact.
	 */
	completedByUserId: string;
	note: string;
}

/**
 * eventTasks/{eventId}_{templateId}
 *
 * A SNAPSHOT of the template at the moment it was attached: title, mode and
 * reminder rules are copied in. Editing a template changes future events, not
 * the reminders already scheduled against live ones.
 *
 * Two fields carry the design:
 *
 *   pendingUserIds   who still owes it. The worker's badge is an
 *                    `array-contains` on this, and it is who the scheduler
 *                    pushes to. Completing is an `arrayRemove` plus a
 *                    `completions.{uid}` field path — both merge-safe offline,
 *                    so no transaction and no clobbering a colleague's tick.
 *
 *   nextReminderAt   materialized, so the scheduler is ONE bounded query
 *                    (`nextReminderAt <= now`) instead of a scan of every
 *                    upcoming event in every company.
 */
export interface EventTask extends BaseDoc, CompanyScoped {
	eventId: string;
	templateId: string;
	/** Denormalized so a push and the worker's list need no second read. */
	eventTitle: string;
	dateKey: DateKey;

	title: string;
	description: string;
	assigneeMode: TaskAssigneeMode;
	requireNote: boolean;

	/** Everyone responsible, done or not. */
	assigneeUserIds: string[];
	/** The subset who have not done it. Empty means the task is settled. */
	pendingUserIds: string[];
	/** Keyed by the user CREDITED with it. */
	completions: Record<string, TaskCompletion>;

	/*
	 * The event's resolved start and end, copied here so a completion or a
	 * reopen can recompute the reminder schedule from the task alone — a
	 * worker ticking a box offline may not have the event in cache.
	 */
	eventStartAt: Timestamp;
	eventEndAt: Timestamp;
	/*
	 * The due rule rides along with the snapshot so `dueAt` can follow the
	 * event when it moves, without the template — which may have been edited
	 * or deleted since.
	 */
	dueAnchor: TaskAnchor;
	dueOffsetSeconds: number;
	dueAt: Timestamp;

	reminders: TaskReminderRule[];
	/** Null when nothing more is scheduled: done, spent, or expired. */
	nextReminderAt: Timestamp | null;
	/** Written by the scheduler only. */
	lastRemindedAt: Timestamp | null;

	/** Snapshot of the template's; see there. */
	dueWarningSeconds?: number | null;
	overdueAlertSeconds: number | null;
	/** Snapshot of the template's; see there. */
	overdueAlertRepeatSeconds?: number | null;
	/** Snapshot of the template's. Empty or absent means every manager. */
	overdueAlertUserIds?: string[];
	/**
	 * When managers next hear about it: the warning before due, then the
	 * overdue alert, then its repeats — see computeNextManagerAlertMs. Null
	 * once settled or when nothing more is owed.
	 */
	overdueAlertAt: Timestamp | null;
	/** Written by the scheduler only: the most recent warning or alert. */
	overdueAlertedAt: Timestamp | null;

	/** No reminder is ever sent after this, whatever the rules say. */
	expiresAt: Timestamp;
}

export const defaultTaskTemplate: Pick<
	TaskTemplate,
	| "title"
	| "description"
	| "assigneeMode"
	| "dueAnchor"
	| "dueOffsetSeconds"
	| "requireNote"
	| "reminders"
	| "dueWarningSeconds"
	| "overdueAlertSeconds"
	| "overdueAlertRepeatSeconds"
	| "overdueAlertUserIds"
> = {
	title: "",
	description: "",
	assigneeMode: "anyone",
	dueAnchor: "eventStart",
	// The day before: early enough to act on, late enough to be relevant.
	dueOffsetSeconds: -24 * 3600,
	requireNote: false,
	reminders: [],
	dueWarningSeconds: null,
	overdueAlertSeconds: null,
	overdueAlertRepeatSeconds: null,
	overdueAlertUserIds: [],
};
