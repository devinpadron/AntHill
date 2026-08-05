import { toDate, toDateKey } from "../primitives/timestamps.mjs";
import { resolveEventDurationSeconds } from "../primitives/duration.mjs";
import { eventResponseId } from "../primitives/ids.mjs";

const SCHEMA_VERSION = 2;

/**
 * Companies/{cid}/Events/{id} -> events/{id}
 *
 * @param {object} ctx `{ companyId, timeZone, labelIds:Set, packageIds:Set, userIds:Set }`
 * @returns {{ doc: object, issues: object[] }}
 */
export function transformEvent(id, v1, ctx) {
	const issues = [];
	const note = (code, detail) => issues.push({ id, code, detail });

	const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(v1.date ?? "") ? v1.date : null;
	if (!dateKey) note("EVENT_NO_DATE", v1.date);

	// Bare times of day ("17:30") carry no date, so they need the event's own
	// dateKey plus the company zone. Discovered only by profiling production.
	const tsCtx = { dateKey, timeZone: ctx.timeZone };
	const start = toDate(v1.startTime, tsCtx);
	const end = toDate(v1.endTime, tsCtx);

	if (!start.ok) note("START_UNPARSEABLE", start.raw);
	if (!end.ok) note("END_UNPARSEABLE", end.raw);
	if (start.assumedTimeZone || end.assumedTimeZone) {
		note("ASSUMED_TIMEZONE", ctx.timeZone);
	}

	const startAt = start.ok ? start.value : null;
	const endAt = end.ok ? end.value : null;

	const duration = resolveEventDurationSeconds({
		startAt,
		endAt,
		legacyDuration: v1.duration,
	});
	if (duration.disagreement)
		note("DURATION_DISAGREEMENT", duration.disagreement);

	// v1 encoded all-day as startTime === null rather than a flag.
	const isAllDay = startAt === null;

	const assignedUserIds = Array.isArray(v1.assignedWorkers)
		? [...new Set(v1.assignedWorkers.filter(Boolean))]
		: [];
	for (const uid of assignedUserIds) {
		if (ctx.userIds && !ctx.userIds.has(uid)) {
			note("ASSIGNED_USER_MISSING", uid);
		}
	}

	// v1 had `label` (typed, never written) and `labelId` (actual).
	const rawLabel = v1.labelId ?? v1.label ?? null;
	let labelId = rawLabel;
	if (labelId && ctx.labelIds && !ctx.labelIds.has(labelId)) {
		note("LABEL_DANGLING", labelId);
		labelId = null;
	}

	// `packages` is a string[]; the {id, quantity} object form eventService
	// assumed is vestigial and never actually written.
	const packageIds = [];
	for (const p of v1.packages ?? []) {
		const pid = typeof p === "string" ? p : (p?.id ?? null);
		if (!pid) continue;
		if (ctx.packageIds && !ctx.packageIds.has(pid)) {
			note("PACKAGE_DANGLING", pid);
			continue;
		}
		packageIds.push(pid);
	}

	const locations = {};
	for (const [address, loc] of Object.entries(v1.locations ?? {})) {
		if (!loc) continue;
		locations[address] = {
			latitude: loc.latitude ?? null,
			longitude: loc.longitude ?? null,
			label: loc.label ?? null,
		};
	}

	return {
		doc: {
			id,
			companyId: ctx.companyId,
			title: v1.title ?? "",
			dateKey,
			isAllDay,
			startAt,
			endAt,
			durationSeconds: duration.seconds,
			adminNotes: v1.notes ?? "",
			workerNotes: v1.userNotes ?? "",
			locations,
			assignedUserIds,
			assignedCount: assignedUserIds.length,
			packageIds,
			checklistIds: [],
			labelId,
			attachmentCount: 0,
			/*
			 * Audience targeting. v1 had no concept of it, so every migrated
			 * event is open to everyone — which is exactly today's behaviour.
			 *
			 * `isTargeted` is written explicitly rather than left absent
			 * because the open-availability query filters on
			 * `isTargeted == false`, and a Firestore equality filter does not
			 * match documents where the field is missing. Absent here would
			 * mean every historical event silently vanished from the
			 * availability list.
			 */
			audienceGroupIds: [],
			audienceUserIds: [],
			isTargeted: false,
			responseCounts: countResponses(v1, assignedUserIds),
			createdAt: startAt ?? null,
			createdBy: null,
			updatedAt: null,
			updatedBy: null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues,
	};
}

/**
 * Counts every response, not just those from currently-assigned workers.
 *
 * An unassigned upcoming event is the AVAILABILITY flow: workers mark whether
 * they can work it before anyone is assigned, so `assignedWorkers` is empty
 * while `workerStatus` carries the real signal. Counting only assigned users
 * reports zero for an event with fifteen replies.
 *
 * The set counted here is exactly the set `transformEventResponses` emits, so
 * the denormalized counter and the documents can never disagree.
 */
function countResponses(v1, assignedUserIds) {
	const counts = { confirmed: 0, declined: 0, pending: 0 };
	const status = normalizeWorkerStatus(v1.workerStatus);
	const responders = new Set([...assignedUserIds, ...Object.keys(status)]);

	for (const uid of responders) {
		const s = status[uid] ?? "pending";
		if (counts[s] === undefined) counts.pending += 1;
		else counts[s] += 1;
	}
	return counts;
}

/**
 * `workerStatus` is typed as an array but written as a map everywhere. Handle
 * both — the array form is defensive only; production has none.
 */
export function normalizeWorkerStatus(workerStatus) {
	if (Array.isArray(workerStatus)) {
		return Object.fromEntries(
			workerStatus
				.filter((w) => w?.userId)
				.map((w) => [w.userId, w.status]),
		);
	}
	if (workerStatus && typeof workerStatus === "object") return workerStatus;
	return {};
}

/**
 * The workerStatus map -> one eventResponses document per (event, user).
 *
 * v1 had two encodings of "pending": absence, and the literal string that
 * undeclineEvent wrote. v2 always states it explicitly.
 *
 * Statuses belonging to users who are no longer assigned are still emitted,
 * flagged `orphanedResponse` — a manager may be looking at that history, so
 * dropping it silently would lose real information.
 */
export function transformEventResponses(eventId, v1, ctx) {
	const status = normalizeWorkerStatus(v1.workerStatus);
	const assigned = Array.isArray(v1.assignedWorkers)
		? [...new Set(v1.assignedWorkers.filter(Boolean))]
		: [];
	const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(v1.date ?? "") ? v1.date : null;

	const docs = [];
	const seen = new Set();

	const emit = (userId, raw, orphaned) => {
		if (seen.has(userId)) return;
		seen.add(userId);
		const value = ["confirmed", "declined", "pending"].includes(raw)
			? raw
			: "pending";
		docs.push({
			id: eventResponseId(eventId, userId),
			companyId: ctx.companyId,
			eventId,
			userId,
			dateKey,
			status: value,
			respondedAt: null,
			updatedAt: null,
			schemaVersion: SCHEMA_VERSION,
			...(orphaned ? { orphanedResponse: true } : {}),
		});
	};

	for (const uid of assigned) emit(uid, status[uid] ?? "pending", false);
	for (const [uid, raw] of Object.entries(status)) {
		if (!assigned.includes(uid)) emit(uid, raw, true);
	}

	return docs;
}

/**
 * Events/{e}/Checklists/* -> one eventChecklistStates/{eventId} document.
 *
 * Values are tri-state integers (0 unchecked / 1 checked / 2 struck through),
 * not booleans. Legacy booleans coerce to 1/0.
 *
 * Keys equal to the literal string "undefined" come from checklists that used
 * the old `string[]` item shape, where `item.id` was undefined. That state is
 * unrecoverable and is dropped — production has zero of these.
 */
export function transformChecklistState(eventId, checklistDocs, ctx) {
	const state = {};
	const issues = [];

	for (const { id: checklistId, data } of checklistDocs) {
		const items = {};
		for (const [itemId, value] of Object.entries(data ?? {})) {
			if (itemId === "undefined") {
				issues.push({
					id: eventId,
					code: "CHECKLIST_STATE_UNDEFINED_KEY",
					detail: checklistId,
				});
				continue;
			}
			items[itemId] =
				typeof value === "boolean"
					? value
						? 1
						: 0
					: Number(value) || 0;
		}
		if (Object.keys(items).length) state[checklistId] = items;
	}

	if (!Object.keys(state).length) return { doc: null, issues };

	return {
		doc: {
			eventId,
			companyId: ctx.companyId,
			state,
			updatedAt: null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues,
	};
}
