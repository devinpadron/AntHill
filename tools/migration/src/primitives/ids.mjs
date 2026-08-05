import { createHash } from "node:crypto";

/*
 * Deterministic IDs. Every one of these is a pure function of the v1 data, so
 * re-running the migration produces byte-identical documents and no duplicates.
 * That property is what makes the loader resumable and `--resume` safe.
 */

export const sha1 = (input) =>
	createHash("sha1").update(input).digest("hex").slice(0, 20);

export const sha256 = (input) =>
	createHash("sha256").update(input).digest("hex");

export const membershipId = (companyId, userId) => `${companyId}_${userId}`;

export const eventResponseId = (eventId, userId) => `${eventId}_${userId}`;

/** Zero-padded so edits sort lexicographically in their original order. */
export const editId = (entryId, seq) =>
	`${entryId}-${String(seq).padStart(4, "0")}`;

/**
 * Connection IDs.
 *
 * Real events keep their event ID. Ad-hoc entries are normalized to a single
 * `custom_` prefix: v1's submit modal WROTE `custom-` (hyphen) while the
 * renderer FILTERED on `custom_` (underscore), so the filter never matched —
 * production has 1,984 connections affected. v2 accepts both on read and emits
 * one form.
 */
export function connectionId(rawEventId) {
	const id = String(rawEventId ?? "");
	const custom = id.match(/^custom[-_](.+)$/);
	return custom ? `custom_${custom[1]}` : id;
}

export const isCustomConnection = (rawEventId) =>
	/^custom[-_]/.test(String(rawEventId ?? ""));

export const formSchemaId = (companyId, kind, version) =>
	`${companyId}_${kind}_v${version}`;

/**
 * Stable hash of a form schema's meaningful content, used to dedupe the many
 * copies embedded across time entries down to a handful of documents.
 * Key order is normalized so an incidental reordering is not a new schema.
 */
export function formSchemaHash(schema) {
	const fields = (schema?.fields ?? []).map((f) => {
		const entries = Object.entries(f)
			.filter(([, v]) => v !== undefined && v !== null)
			.sort(([a], [b]) => a.localeCompare(b));
		return Object.fromEntries(entries);
	});

	return sha256(
		JSON.stringify({
			title: schema?.title ?? "",
			description: schema?.description ?? "",
			isEnabled: schema?.isEnabled !== false,
			fields,
		}),
	);
}
