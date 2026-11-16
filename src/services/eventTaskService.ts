import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C, eventTaskId } from "../constants/paths";
import { Event, EventTask, TaskCompletion, TaskTemplate } from "../types";
import {
	anchorMs,
	computeNextReminderMs,
	pendingFor,
	resolveAnchors,
	resolveAssignees,
	TASK_EXPIRY_SECONDS,
} from "../utils/eventTaskUtils";
import { getPackagesByIds } from "./libraryService";
import { track } from "./offline/pendingWrites";

/*
 * Event tasks: the template library, and the per-event task documents made
 * from it.
 *
 * WHO WRITES WHAT
 *
 *   managers     templates, and — through syncEventTasks, which eventService
 *                runs after every event write that could matter — the task
 *                documents themselves: who is responsible, when it is due,
 *                when the next reminder is.
 *   assignees    their own completion, and nothing else. The rules pin them to
 *                `pendingUserIds`, `completions` and the two schedule fields
 *                that have to be cleared when the last person finishes.
 *   the          `lastRemindedAt`, `overdueAlertedAt`, and advancing
 *   scheduler    `nextReminderAt` after each send. Admin SDK, so no rule.
 *
 * There are no transactions here, for the reason given at the top of
 * timeEntryService: `tx.get()` bypasses the cache and fails outright offline.
 * A completion is an `arrayRemove` and a dotted field path, both of which the
 * server merges into whatever the document holds by then.
 */

const LIBRARY_LIMIT = 200;

/** Most tasks one event carries. Packages plus direct picks; far above real use. */
const EVENT_TASK_LIMIT = 100;

/**
 * Most open tasks shown to one worker.
 *
 * Exported because a caller can hit it: the query is ordered by `dateKey`
 * ascending from a recent floor, so the cap sheds the FURTHEST-OUT tasks.
 */
export const MY_TASKS_LIMIT = 100;

const ts = (ms: number) => firestore.Timestamp.fromMillis(ms);
const millis = (
	value: FirebaseFirestoreTypes.Timestamp | null | undefined,
): number | null => (value ? value.toMillis() : null);

const toTask = (doc: FirebaseFirestoreTypes.DocumentSnapshot): EventTask => ({
	...(doc.data() as EventTask),
	id: doc.id,
});

/* --------------------------------------------------------------- templates */

export function subscribeTaskTemplates(
	companyId: string,
	onChange: (templates: TaskTemplate[]) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.taskTemplates)
		.where("companyId", "==", companyId)
		.orderBy("title")
		.limit(LIBRARY_LIMIT)
		.onSnapshot(
			(snapshot) =>
				onChange(
					snapshot.docs.map((d) => ({
						...(d.data() as TaskTemplate),
						id: d.id,
					})),
				),
			(error) =>
				console.error("Error subscribing to task templates", error),
		);
}

/**
 * Templates by id, ONE DOCUMENT AT A TIME — the same reason as
 * getChecklistsByIds. These ids are held second-hand, on events and packages,
 * so a deleted template leaves one pointing at nothing; a keyed `in` lookup
 * turns that into permission-denied for the whole set.
 */
export async function getTaskTemplatesByIds(
	companyId: string,
	ids: string[],
): Promise<Record<string, TaskTemplate>> {
	const unique = [...new Set(ids.filter(Boolean))];
	const result: Record<string, TaskTemplate> = {};
	if (!unique.length) return result;

	const found = await Promise.all(
		unique.map(async (id) => {
			try {
				const doc = await db.collection(C.taskTemplates).doc(id).get();
				if (!doc.exists()) return null;
				const template = {
					...(doc.data() as TaskTemplate),
					id: doc.id,
				};
				return template.companyId === companyId ? template : null;
			} catch (e) {
				console.error(`Error getting task template ${id}`, e);
				return null;
			}
		}),
	);

	for (const template of found) {
		if (template) result[template.id] = template;
	}
	return result;
}

export async function saveTaskTemplate(
	companyId: string,
	template: Partial<TaskTemplate> & { id?: string },
): Promise<string> {
	const ref = template.id
		? db.collection(C.taskTemplates).doc(template.id)
		: db.collection(C.taskTemplates).doc();

	await ref.set(
		{
			...template,
			id: ref.id,
			companyId,
			updatedAt: firestore.FieldValue.serverTimestamp(),
			...(template.id
				? {}
				: { createdAt: firestore.FieldValue.serverTimestamp() }),
			schemaVersion: 2,
		},
		{ merge: true },
	);

	return ref.id;
}

/**
 * Deletes the template only.
 *
 * Tasks already attached to events are snapshots and keep running — a manager
 * tidying the library must not silently cancel a reminder a crew is relying
 * on. The dangling id left on events and packages is skipped by the next sync.
 */
export async function deleteTaskTemplate(templateId: string): Promise<void> {
	await db.collection(C.taskTemplates).doc(templateId).delete();
}

/* ------------------------------------------------------------- event tasks */

export function subscribeEventTasks(
	companyId: string,
	eventId: string,
	onChange: (tasks: EventTask[]) => void,
): () => void {
	if (!companyId || !eventId) return () => {};

	return db
		.collection(C.eventTasks)
		.where("companyId", "==", companyId)
		.where("eventId", "==", eventId)
		.limit(EVENT_TASK_LIMIT)
		.onSnapshot(
			(snapshot) =>
				onChange(
					snapshot.docs
						.map(toTask)
						.sort(
							(a, b) =>
								(millis(a.dueAt) ?? 0) -
									(millis(b.dueAt) ?? 0) ||
								a.title.localeCompare(b.title),
						),
				),
			(error) => console.error("Error subscribing to event tasks", error),
		);
}

/**
 * Every task this user still owes, soonest event first.
 *
 * `fromDateKey` is a FLOOR, and callers pass one a little in the past: a task
 * can fall due after its event, so "today onwards" would drop exactly the ones
 * that are overdue. Without any floor the query would return every task the
 * worker ever left open, forever.
 *
 * Needs the (companyId, pendingUserIds, dateKey) composite index declared in
 * firestore.indexes.json.
 */
export function subscribeMyPendingTasks(
	companyId: string,
	userId: string,
	fromDateKey: string,
	onChange: (tasks: EventTask[]) => void,
	onError?: (error: Error) => void,
): () => void {
	if (!companyId || !userId) return () => {};

	return db
		.collection(C.eventTasks)
		.where("companyId", "==", companyId)
		.where("pendingUserIds", "array-contains", userId)
		.where("dateKey", ">=", fromDateKey)
		.orderBy("dateKey")
		.limit(MY_TASKS_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(snapshot.docs.map(toTask)),
			(error) => {
				console.error("Error subscribing to my tasks", error);
				onError?.(error);
			},
		);
}

/** The schedule fields that follow from who is pending and when the event is. */
function scheduleFor(input: {
	task: Pick<
		EventTask,
		"reminders" | "overdueAlertSeconds" | "lastRemindedAt"
	>;
	startMs: number;
	endMs: number;
	dueMs: number;
	hasPending: boolean;
	/** Null once the alert has gone out and should not repeat. */
	overdueAlertedMs: number | null;
	nowMs: number;
}) {
	const expiresMs = input.endMs + TASK_EXPIRY_SECONDS * 1000;

	const nextMs = computeNextReminderMs({
		rules: input.task.reminders ?? [],
		startMs: input.startMs,
		endMs: input.endMs,
		lastRemindedMs: millis(input.task.lastRemindedAt),
		nowMs: input.nowMs,
		expiresMs,
		hasPending: input.hasPending,
	});

	const alertSeconds = input.task.overdueAlertSeconds;
	const alertMs =
		input.hasPending &&
		alertSeconds !== null &&
		alertSeconds !== undefined &&
		input.overdueAlertedMs === null
			? input.dueMs + alertSeconds * 1000
			: null;

	return {
		expiresMs,
		nextReminderAt: nextMs === null ? null : ts(nextMs),
		// An alert that could only fire after expiry is not scheduled at all.
		overdueAlertAt:
			alertMs !== null && alertMs <= expiresMs ? ts(alertMs) : null,
	};
}

const sameSet = (a: string[] = [], b: string[] = []) =>
	a.length === b.length && a.every((id) => b.includes(id));

/**
 * Brings an event's task documents in line with the event.
 *
 * The effective set is the union of the event's own `taskTemplateIds` and
 * every attached package's. For each one:
 *
 *   - no document yet: snapshot the template into one.
 *   - a document exists: leave its snapshot alone (title, rules) and recompute
 *     only what follows from the EVENT — who is responsible, who is still
 *     pending, the due time and the next reminder. Completions are never
 *     touched, so re-saving an event cannot un-tick anything.
 *   - a document whose template is no longer attached: deleted. The manager
 *     removed the task from this event; chasing it further would be wrong.
 *
 * Re-runnable and idempotent: ids are deterministic and unchanged documents
 * are not rewritten, so an edit to an event's title costs one cached query
 * and no writes.
 *
 * Takes the SAVED event rather than a patch — the caller has to read it back
 * anyway, since a patch rarely carries both the crew and the times.
 */
export async function syncEventTasks(event: Event): Promise<void> {
	const companyId = event?.companyId;
	if (!companyId || !event.id || !event.dateKey) return;

	try {
		const [packages, existingSnap] = await Promise.all([
			getPackagesByIds(companyId, event.packageIds ?? []),
			db
				.collection(C.eventTasks)
				.where("companyId", "==", companyId)
				.where("eventId", "==", event.id)
				.limit(EVENT_TASK_LIMIT)
				.get(),
		]);

		const templateIds = [
			...new Set(
				[
					...(event.taskTemplateIds ?? []),
					...packages.flatMap((pkg) => pkg.taskTemplateIds ?? []),
				].filter(Boolean),
			),
		];

		// The common case for a company not using tasks: nothing to do.
		if (!templateIds.length && existingSnap.empty) return;

		const existing = new Map(
			existingSnap.docs.map((doc) => [
				(doc.data() as EventTask).templateId,
				doc,
			]),
		);

		// Only NEW tasks need their template; existing ones are snapshots.
		const templates = await getTaskTemplatesByIds(
			companyId,
			templateIds.filter((id) => !existing.has(id)),
		);

		const anchors = resolveAnchors({
			dateKey: event.dateKey,
			startAt: event.startAt ? event.startAt.toDate() : null,
			endAt: event.endAt ? event.endAt.toDate() : null,
		});
		const crew = event.assignedUserIds ?? [];
		const nowMs = Date.now();
		const now = firestore.FieldValue.serverTimestamp();

		const batch = db.batch();
		let writes = 0;

		for (const templateId of templateIds) {
			const doc = existing.get(templateId);

			if (!doc) {
				const template = templates[templateId];
				// Deleted from the library since it was attached.
				if (!template) continue;

				const assignees = resolveAssignees(
					template.assigneeMode,
					crew,
					event.taskAssignees?.[templateId],
				);
				const dueMs =
					anchorMs(template.dueAnchor, anchors) +
					template.dueOffsetSeconds * 1000;
				const fresh = {
					reminders: template.reminders ?? [],
					overdueAlertSeconds: template.overdueAlertSeconds ?? null,
					lastRemindedAt: null,
				};
				const schedule = scheduleFor({
					task: fresh,
					...anchors,
					dueMs,
					hasPending: assignees.length > 0,
					overdueAlertedMs: null,
					nowMs,
				});

				const id = eventTaskId(event.id, templateId);
				batch.set(db.collection(C.eventTasks).doc(id), {
					id,
					companyId,
					eventId: event.id,
					templateId,
					eventTitle: event.title ?? "",
					dateKey: event.dateKey,
					title: template.title ?? "",
					description: template.description ?? "",
					assigneeMode: template.assigneeMode,
					requireNote: Boolean(template.requireNote),
					/*
					 * The due rule rides along with the snapshot so a later
					 * sync can move `dueAt` when the event moves without the
					 * template — which may have been edited or deleted since.
					 */
					dueAnchor: template.dueAnchor,
					dueOffsetSeconds: template.dueOffsetSeconds,
					assigneeUserIds: assignees,
					pendingUserIds: assignees,
					completions: {},
					eventStartAt: ts(anchors.startMs),
					eventEndAt: ts(anchors.endMs),
					dueAt: ts(dueMs),
					...fresh,
					nextReminderAt: schedule.nextReminderAt,
					overdueAlertAt: schedule.overdueAlertAt,
					overdueAlertedAt: null,
					expiresAt: ts(schedule.expiresMs),
					createdAt: now,
					updatedAt: now,
					schemaVersion: 2,
				});
				writes += 1;
				continue;
			}

			const task = doc.data() as EventTask;

			const assignees = resolveAssignees(
				task.assigneeMode,
				crew,
				event.taskAssignees?.[templateId],
			);
			const pending = pendingFor(
				task.assigneeMode,
				assignees,
				task.completions,
			);
			const dueMs =
				anchorMs(task.dueAnchor ?? "eventStart", anchors) +
				(task.dueOffsetSeconds ?? 0) * 1000;
			const dueMoved = millis(task.dueAt) !== dueMs;

			const schedule = scheduleFor({
				task,
				...anchors,
				dueMs,
				hasPending: pending.length > 0,
				// A due time that moved makes the old alert about a deadline
				// that no longer exists, so it may fire again for the new one.
				overdueAlertedMs: dueMoved
					? null
					: millis(task.overdueAlertedAt),
				nowMs,
			});

			const unchanged =
				!dueMoved &&
				sameSet(task.assigneeUserIds, assignees) &&
				sameSet(task.pendingUserIds, pending) &&
				task.eventTitle === (event.title ?? "") &&
				task.dateKey === event.dateKey &&
				millis(task.eventStartAt) === anchors.startMs &&
				millis(task.eventEndAt) === anchors.endMs &&
				/*
				 * A reminder already scheduled in the future is left where it
				 * is. Only its ABSENCE or presence is compared: recomputing a
				 * "now" candidate on every save would otherwise rewrite the
				 * document each time anyone touched the event.
				 */
				(task.nextReminderAt === null) ===
					(schedule.nextReminderAt === null) &&
				(task.overdueAlertAt === null) ===
					(schedule.overdueAlertAt === null);

			if (unchanged) continue;

			batch.update(doc.ref, {
				eventTitle: event.title ?? "",
				dateKey: event.dateKey,
				assigneeUserIds: assignees,
				pendingUserIds: pending,
				eventStartAt: ts(anchors.startMs),
				eventEndAt: ts(anchors.endMs),
				dueAt: ts(dueMs),
				nextReminderAt: schedule.nextReminderAt,
				overdueAlertAt: schedule.overdueAlertAt,
				...(dueMoved ? { overdueAlertedAt: null } : {}),
				expiresAt: ts(schedule.expiresMs),
				updatedAt: now,
			});
			writes += 1;
		}

		const wanted = new Set(templateIds);
		for (const [templateId, doc] of existing) {
			if (wanted.has(templateId)) continue;
			batch.delete(doc.ref);
			writes += 1;
		}

		if (writes) await batch.commit();
	} catch (e) {
		console.error("Error syncing event tasks", e);
		throw e;
	}
}

/**
 * Marks a task done for `userId`.
 *
 * `completedByUserId` is the person tapping. It differs from `userId` when a
 * manager ticks it on a worker's behalf, and both are recorded.
 *
 * Computed from the snapshot the caller already holds, and NOT awaited: the
 * promise resolves on server acknowledgement, so awaiting it would hang a
 * worker ticking a box in a venue basement. The write is queued and raises its
 * local snapshot immediately; a genuine rejection surfaces through
 * pendingWrites.
 *
 * `completedAt` is a client timestamp for the same reason every business
 * timestamp is — serverTimestamp() reads back as null in the local snapshot,
 * and the row would show "done" with no time until the device next synced.
 */
export function completeEventTask(
	task: EventTask,
	userId: string,
	completedByUserId: string,
	note = "",
): void {
	const completion: TaskCompletion = {
		completedAt: firestore.Timestamp.fromDate(new Date()),
		completedByUserId,
		note: note.trim(),
	};

	const pending = pendingFor(task.assigneeMode, task.assigneeUserIds ?? [], {
		...(task.completions ?? {}),
		[userId]: completion,
	});

	const update: Record<string, unknown> = {
		[`completions.${userId}`]: completion,
		pendingUserIds:
			task.assigneeMode === "anyone"
				? []
				: firestore.FieldValue.arrayRemove(userId),
		updatedAt: firestore.FieldValue.serverTimestamp(),
	};

	/*
	 * Settled, as far as this device can tell. Two workers finishing an
	 * "everyone" task offline each see the other still pending, so neither
	 * clears these — the scheduler does, on finding nobody left to remind.
	 */
	if (!pending.length) {
		update.nextReminderAt = null;
		update.overdueAlertAt = null;
	}

	track(
		"completeEventTask",
		db.collection(C.eventTasks).doc(task.id).update(update),
	);
}

/**
 * Undoes a completion: a worker's own mis-tap, or a manager who is not
 * satisfied it was really done.
 *
 * On an `anyone` task there is one completion standing for the whole crew, so
 * reopening hands the task back to all of them.
 */
export function reopenEventTask(task: EventTask, userId: string): void {
	const completions = { ...(task.completions ?? {}) };
	delete completions[userId];

	const pending = pendingFor(
		task.assigneeMode,
		task.assigneeUserIds ?? [],
		completions,
	);

	const startMs = millis(task.eventStartAt) ?? Date.now();
	const endMs = millis(task.eventEndAt) ?? startMs;
	const schedule = scheduleFor({
		task,
		startMs,
		endMs,
		dueMs: millis(task.dueAt) ?? startMs,
		hasPending: pending.length > 0,
		overdueAlertedMs: millis(task.overdueAlertedAt),
		nowMs: Date.now(),
	});

	track(
		"reopenEventTask",
		db
			.collection(C.eventTasks)
			.doc(task.id)
			.update({
				[`completions.${userId}`]: firestore.FieldValue.delete(),
				pendingUserIds: pending,
				nextReminderAt: schedule.nextReminderAt,
				overdueAlertAt: schedule.overdueAlertAt,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			}),
	);
}
