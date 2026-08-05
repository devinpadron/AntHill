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

export const getStatusBadgeColor = (status: string): string => {
	switch (status) {
		case "approved":
			return "#d4edda"; // Green
		case "pending_approval":
			return "#fff3cd"; // Orange
		case "edited":
			return "#cce5ff"; // Yellow
		case "active":
			return "#d1ecf1"; // Blue
		case "paused":
			return "#fff3cd"; // Orange
		case "rejected":
			return "#f8d7da"; // Red
		default:
			return "#f8d7da"; // Grey
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
