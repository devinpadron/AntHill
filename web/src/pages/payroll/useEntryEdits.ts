import { useCallback } from "react";
import { updateTimeEntry } from "@app/services/timeEntryService";
import {
	appendEdit,
	updateConnectionResponses,
} from "@app/services/timeEntryEditService";
import type { FormField, TimeEntry, TimeEntryConnection } from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";

/*
 * Saving one form answer, from wherever it is being displayed.
 *
 * Two destinations, because the answers live in two places:
 *   the entry's own answers   timeEntries/{id}.formResponses
 *   a connected event's       timeEntries/{id}/connections/{cid}.formResponses
 *
 * Both append to the entry's edit history through the same `appendEdit` the
 * app uses, so an inline correction is exactly as traceable as one made through
 * the edit sheet. A change that leaves no trace is worse than one that costs a
 * click.
 *
 * A failed history write does NOT fail the edit — the value is already saved,
 * and reporting it as a failure would invite the admin to type it again.
 */
export function useEntryEdits() {
	const { companyId } = useCompany();
	const { userId, user } = useAuth();

	const actorDisplayName = user
		? `${user.firstName} ${user.lastName}`.trim()
		: userId;

	const record = useCallback(
		async (entry: TimeEntry, summary: string) => {
			await appendEdit(companyId, entry.id, {
				summary,
				actorUserId: userId,
				actorDisplayName,
				before: {
					clockInAt: entry.clockInAt ?? null,
					clockOutAt: entry.clockOutAt ?? null,
					workedSeconds: entry.workedSeconds ?? null,
					notes: entry.notes ?? null,
					formResponses: entry.formResponses ?? null,
				},
			}).catch(() =>
				console.error("Edit saved but not recorded in history"),
			);
		},
		[companyId, userId, actorDisplayName],
	);

	/** An answer on the time entry itself. */
	const saveEntryField = useCallback(
		async (
			entry: TimeEntry,
			field: FormField,
			next: unknown,
			previousDisplay: string,
		) => {
			await updateTimeEntry(entry.id, {
				formResponses: {
					...(entry.formResponses ?? {}),
					[field.id]: next as never,
				},
			});
			await record(
				entry,
				`${field.label}: ${previousDisplay || "—"} → ${
					next === null || next === "" ? "—" : String(next)
				}`,
			);
		},
		[record],
	);

	/** An answer on a connected event. */
	const saveConnectionField = useCallback(
		async (
			entry: TimeEntry,
			connection: TimeEntryConnection,
			field: FormField,
			next: unknown,
			previousDisplay: string,
		) => {
			await updateConnectionResponses(entry.id, connection.id, {
				...(connection.formResponses ?? {}),
				[field.id]: next as never,
			});
			const eventName =
				connection.customTitle ||
				connection.eventTitleSnapshot ||
				"event";
			await record(
				entry,
				`${eventName} — ${field.label}: ${previousDisplay || "—"} → ${
					next === null || next === "" ? "—" : String(next)
				}`,
			);
		},
		[record],
	);

	return { saveEntryField, saveConnectionField };
}
