import { toDate, toDateKey } from "../primitives/timestamps.mjs";
import { secondsBetween } from "../primitives/duration.mjs";
import {
	connectionId,
	editId,
	isCustomConnection,
} from "../primitives/ids.mjs";

const SCHEMA_VERSION = 2;

/**
 * Resolves who approved or rejected an entry.
 *
 * v1's approve path wrote `rejectedAt`/`rejectedBy` (TimeEntryDetails.tsx), and
 * `approvedBy`/`approvedAt` were never written by ANY code path. Production has
 * 2,104 approved entries stamped `rejectedBy` against 12 with a real
 * `approvedBy` — so for 99.4% of the approval history the actor is inferred,
 * and that inference cannot be validated against anything.
 *
 * `status` is the only trustworthy signal, so it decides; the actor and
 * timestamp are taken from whichever field happens to hold them.
 */
export function resolveReview(v1) {
	const status = v1.status;

	if (status === "approved") {
		if (v1.approvedBy) {
			return {
				decision: "approved",
				decidedBy: v1.approvedBy,
				decidedAt: parseOrNull(v1.approvedAt),
				reason: null,
				provenance: "trusted",
			};
		}
		if (v1.rejectedBy) {
			return {
				decision: "approved",
				decidedBy: v1.rejectedBy,
				decidedAt: parseOrNull(v1.rejectedAt),
				reason: null,
				provenance: "inferred_from_status_bug",
			};
		}
		return {
			decision: "approved",
			decidedBy: null,
			decidedAt: null,
			reason: null,
			provenance: "unknown",
		};
	}

	if (status === "rejected") {
		return {
			decision: "rejected",
			decidedBy: v1.rejectedBy ?? null,
			decidedAt: parseOrNull(v1.rejectedAt),
			reason: v1.rejectionReason ?? null,
			provenance: v1.rejectedBy ? "trusted" : "unknown",
		};
	}

	return null;
}

const parseOrNull = (value) => {
	const r = toDate(value);
	return r.ok ? r.value : null;
};

/** The raw v1 approval fields, kept verbatim because the inference is lossy. */
function legacyApproval(v1) {
	const legacy = {};
	for (const k of ["approvedBy", "approvedAt", "rejectedBy", "rejectedAt"]) {
		if (v1[k] !== undefined) legacy[k] = v1[k];
	}
	return Object.keys(legacy).length ? legacy : null;
}

/**
 * Companies/{cid}/TimeEntries/{id} -> timeEntries/{id}
 *
 * @param {object} ctx `{ companyId, timeZone, schemaIdFor }`
 *   `schemaIdFor(kind, embeddedSchema)` resolves an embedded schema snapshot to
 *   its deduped formSchemas document.
 */
export function transformTimeEntry(id, v1, ctx) {
	const issues = [];
	const note = (code, detail) => issues.push({ id, code, detail });

	const clockIn = toDate(v1.clockInTime, { timeZone: ctx.timeZone });
	const clockOut = toDate(v1.clockOutTime, { timeZone: ctx.timeZone });

	if (!clockIn.ok) note("CLOCK_IN_UNPARSEABLE", clockIn.raw);
	if (!clockOut.ok) note("CLOCK_OUT_UNPARSEABLE", clockOut.raw);

	const clockInAt = clockIn.ok ? clockIn.value : null;
	const clockOutAt = clockOut.ok ? clockOut.value : null;

	const workedSeconds =
		typeof v1.duration === "number" ? Math.round(v1.duration) : null;

	// clockOut clamped at zero but never validated the upper bound.
	const elapsed = secondsBetween(clockInAt, clockOutAt);
	if (
		workedSeconds !== null &&
		elapsed !== null &&
		workedSeconds > elapsed + 60
	) {
		note("WORKED_EXCEEDS_ELAPSED", { workedSeconds, elapsed });
	}

	const eventSchema = ctx.schemaIdFor?.("eventForm", v1.eventForm) ?? null;
	const entrySchema =
		ctx.schemaIdFor?.("timeEntryForm", v1.generalForm) ?? null;

	return {
		doc: {
			id,
			companyId: ctx.companyId,
			userId: v1.userId ?? null,
			status: v1.status ?? "completed",
			clockInAt,
			clockOutAt,
			dateKey: toDateKey(clockInAt, ctx.timeZone),
			workedSeconds,
			pausedSeconds: Math.round(v1.totalPausedSeconds ?? 0),
			pauseStartedAt: parseOrNull(v1.pauseStartTime),
			notes: v1.notes ?? "",
			formSchemaIds: {
				timeEntry: entrySchema?.id ?? null,
				event: eventSchema?.id ?? null,
			},
			formSchemaHashes: {
				timeEntry: entrySchema?.hash ?? null,
				event: eventSchema?.hash ?? null,
			},
			formResponses: v1.formResponses ?? {},
			connectionCount: (v1.connectedEvents ?? []).length,
			editCount: (v1.editHistory ?? []).length,
			submission: v1.submittedAt
				? {
						submittedAt: parseOrNull(v1.submittedAt),
						notes: v1.submissionNotes ?? "",
					}
				: null,
			review: resolveReview(v1),
			legacy: legacyApproval(v1),
			createdAt: clockInAt,
			updatedAt: null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues,
	};
}

/**
 * connectedEvents[] -> the connections subcollection.
 *
 * `eventId` becomes null for ad-hoc entries so downstream code stops
 * pattern-matching on an ID prefix — which is how the `custom-` vs `custom_`
 * mismatch went unnoticed across 1,984 records.
 */
export function transformConnections(entryId, v1, ctx) {
	const issues = [];
	const docs = [];
	const seen = new Set();

	for (const conn of v1.connectedEvents ?? []) {
		const rawId = conn?.eventId ?? "";
		const custom = isCustomConnection(rawId);
		let eventId = custom ? null : rawId || null;

		if (eventId && ctx.eventIds && !ctx.eventIds.has(eventId)) {
			issues.push({
				id: entryId,
				code: "CONNECTION_DANGLING",
				detail: rawId,
			});
			eventId = null;
		}

		const cid = connectionId(rawId) || `custom_${docs.length}`;
		if (seen.has(cid)) continue;
		seen.add(cid);

		docs.push({
			id: cid,
			companyId: ctx.companyId,
			entryId,
			userId: v1.userId ?? null,
			eventId,
			customTitle: eventId ? null : (conn?.eventTitle ?? null),
			eventTitleSnapshot: conn?.eventTitle ?? "",
			formResponses: conn?.formResponses ?? {},
			createdAt: null,
			schemaVersion: SCHEMA_VERSION,
		});
	}

	return { docs, issues };
}

/**
 * editHistory[] -> the edits subcollection, one shape.
 *
 * v1 had three writer shapes and a renderer that read a FOURTH key set
 * (`userName`/`changeSummary`) no writer ever produced — which is why edit
 * history has never shown an author. Production: 2,088 shape B, 20 shape A,
 * zero with `userName`.
 *
 * @param {object} ctx `{ companyId, displayNameFor }`
 */
export function transformEdits(entryId, v1, ctx) {
	const docs = [];
	const issues = [];

	(v1.editHistory ?? []).forEach((raw, seq) => {
		let actorUserId = null;
		let actorDisplayName = null;
		let summary = "";
		let before = null;
		let source = "legacy_unknown";

		if (raw?.editor) {
			// Shape A — EditSheet
			source = "editSheet";
			actorUserId = raw.editor.userId ?? null;
			actorDisplayName = raw.editor.displayName ?? null;
			summary = raw.summary ?? "";
			before = {
				clockInAt: parseOrNull(raw.previousClockInTime),
				clockOutAt: parseOrNull(raw.previousClockOutTime),
				workedSeconds:
					typeof raw.previousDuration === "number"
						? Math.round(raw.previousDuration)
						: null,
				notes: raw.previousNotes ?? null,
				formResponses: raw.previousFormResponses ?? null,
			};
		} else if (raw?.userId && raw?.changeSummary) {
			// Shape B — TimeEntryDetails
			source = "detailsField";
			actorUserId = raw.userId;
			actorDisplayName = ctx.displayNameFor?.(raw.userId) ?? null;
			summary = raw.changeSummary;
		} else {
			issues.push({
				id: entryId,
				code: "EDIT_SHAPE_UNKNOWN",
				detail: seq,
			});
			summary = JSON.stringify(raw ?? {}).slice(0, 500);
		}

		docs.push({
			id: editId(entryId, seq),
			companyId: ctx.companyId,
			entryId,
			at: parseOrNull(raw?.timestamp),
			actorUserId,
			actorDisplayName,
			summary,
			before,
			source,
			seq,
			schemaVersion: SCHEMA_VERSION,
			...(source === "legacy_unknown" ? { rawLegacy: raw ?? null } : {}),
		});
	});

	return { docs, issues };
}
