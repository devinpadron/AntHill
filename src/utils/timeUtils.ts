import { FormField, FormFieldType, FormResponses, FormSchema } from "../types";

export const formatDuration = (seconds: number): string => {
	if (!seconds) return "0h 0m";

	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);

	if (hours > 0) {
		return `${hours}h ${minutes}m`;
	}
	return `${minutes}m`;
};

/**
 * Seconds as a running clock — `H:MM:SS`, or `MM:SS` under an hour.
 *
 * For a display that updates every second. `formatDuration` is the one for
 * totals ("2h 15m"); this one keeps the seconds column, which is what makes a
 * timer read as live rather than stuck.
 */
export const formatStopwatch = (totalSeconds: number): string => {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const seconds = safe % 60;

	const mm = String(minutes).padStart(2, "0");
	const ss = String(seconds).padStart(2, "0");

	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

export const calculateMultipliedValue = (
	value: any,
	multiplier: number,
): string | null => {
	if (!value || !multiplier) return null;

	const numValue = parseFloat(value);
	if (isNaN(numValue)) return null;

	const result = numValue * multiplier;
	return result % 1 !== 0 ? result.toFixed(2) : result.toString();
};

/**
 * The set of ticked entries in a checklist field's stored response.
 *
 * What "ticked" looks like on disk has three shapes. `CustomFormRender` writes
 * an array of item TEXT; older and hand-edited entries can carry an array of
 * item IDS, or a map of `{ itemId: boolean }`. Anything comparing against only
 * one of them renders every item as unticked — which is how a submitted
 * checklist came back looking like a plain list of options.
 *
 * Shared by the reader and the editor so the two cannot disagree about whether
 * an item is done.
 */
export const checklistCheckedSet = (response: unknown): Set<string> => {
	const checked = new Set<string>();

	if (Array.isArray(response)) {
		response.forEach((entry) => {
			if (typeof entry === "string") {
				checked.add(entry);
			} else if (entry && typeof entry === "object") {
				// `[{id, text}]` — take whichever identifies it.
				const item = entry as { id?: string; text?: string };
				if (item.id) checked.add(item.id);
				if (item.text) checked.add(item.text);
			}
		});
	} else if (response && typeof response === "object") {
		Object.entries(response as Record<string, unknown>).forEach(
			([key, value]) => {
				if (value) checked.add(key);
			},
		);
	}

	return checked;
};

/**
 * A time entry's status as a semantic badge tone.
 *
 * Replaced a helper that returned a raw pastel hex — fine on white, unreadable
 * on a dark surface. The tone resolves through the theme, so one mapping
 * serves both modes.
 */
export const getStatusTone = (
	status: string,
): "neutral" | "accent" | "success" | "warning" | "danger" => {
	switch (status) {
		case "approved":
			return "success";
		case "active":
			return "accent";
		case "paused":
		case "pending_approval":
		case "edited":
			return "warning";
		case "rejected":
			return "danger";
		default:
			return "neutral";
	}
};

export const getStatusBadgeText = (status: string): string => {
	switch (status) {
		case "approved":
			return "Approved";
		case "pending_approval":
			return "Pending Approval";
		case "edited":
			return "Edited";
		case "active":
			return "Active";
		case "paused":
			return "Paused";
		case "rejected":
			return "Rejected";
		default:
			return "Not Submitted";
	}
};

export type FieldTotal = {
	label: string;
	total: number;
	rawTotal: number;
	unit: string;
	useMultiplier: boolean;
	multiplier: number;
	multipliedTotal?: number;
	type: FormFieldType;
	source: "timeEntry" | "event";
};

/**
 * One entry with everything needed to total it.
 *
 * Schemas and connections are passed in already resolved rather than read off
 * the entry. v1 embedded a full copy of both form schemas on every submitted
 * entry and kept connections in an inline `connectedEvents` array; v2 stores
 * schema REFERENCES (`formSchemaIds`) and connections as their own documents,
 * so only the caller — which has a service layer to reach — can supply them.
 *
 * Keeping this function pure is the point: it stays trivially testable, and the
 * screen decides how to batch the reads.
 */
export type EntryTotalsInput = {
	formResponses?: FormResponses;
	timeEntrySchema?: FormSchema | null;
	eventSchema?: FormSchema | null;
	connections?: { formResponses?: FormResponses }[];
};

const TOTALLED_TYPES: FormFieldType[] = ["number", "currency", "quantity"];

const totalledFields = (schema?: FormSchema | null): FormField[] =>
	(schema?.fields ?? []).filter(
		(field) =>
			field.showTotal === true && TOTALLED_TYPES.includes(field.type),
	);

/**
 * Folds one set of responses into the running totals.
 *
 * The time-entry and connected-event passes were near-identical copies of this
 * before; they differ only in key prefix, label, and source tag.
 */
const accumulate = (
	totals: Record<string, FieldTotal>,
	fields: FormField[],
	responses: FormResponses | undefined,
	source: FieldTotal["source"],
) => {
	const prefix = source === "event" ? "ev" : "te";

	fields.forEach((field) => {
		const key = `${prefix}_${field.id}`;

		if (!totals[key]) {
			totals[key] = {
				label:
					source === "event"
						? `${field.label} (Events)`
						: field.label,
				total: 0,
				rawTotal: 0,
				unit: field.unit || "",
				useMultiplier: field.useMultiplier || false,
				multiplier: field.multiplier || 1,
				type: field.type,
				source,
			};
		}

		const value = responses?.[field.id];
		if (value === undefined || value === null) return;

		const numValue = parseFloat(value as string);
		if (isNaN(numValue)) return;

		const running = totals[key];
		running.total += numValue;
		// The pre-multiplier figure, kept so the UI can show both.
		running.rawTotal = running.total;

		if (field.useMultiplier && field.multiplier) {
			running.multipliedTotal = running.total * field.multiplier;
		}
	});
};

/** Sums every `showTotal` numeric field across the given entries. */
export const calculateFieldTotals = (
	entries: EntryTotalsInput[],
): Record<string, FieldTotal> => {
	const totals: Record<string, FieldTotal> = {};

	entries?.forEach((entry) => {
		accumulate(
			totals,
			totalledFields(entry.timeEntrySchema),
			entry.formResponses,
			"timeEntry",
		);

		const eventFields = totalledFields(entry.eventSchema);
		entry.connections?.forEach((connection) => {
			accumulate(totals, eventFields, connection.formResponses, "event");
		});
	});

	return totals;
};
