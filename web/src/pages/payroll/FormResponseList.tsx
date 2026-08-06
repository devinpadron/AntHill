import { checklistCheckedSet } from "@app/utils/timeUtils";
import type {
	Checklist,
	FormField,
	FormResponses,
	FormSchema,
} from "@app/types";
import { Badge, Icon, Text } from "../../ui";
import { EditableField } from "./EditableField";
import styles from "./FormResponseList.module.css";

/*
 * Answers to a company-defined form.
 *
 * Fields are company-configured, so nothing here can assume a shape — the
 * schema names the fields and their types, and the responses are keyed by field
 * id. When no schema is available (a connection's event-form answers, or a
 * schema that failed to load) the raw keys are shown rather than nothing: an
 * admin chasing a discrepancy would rather see `field_3: 12` than an empty
 * card.
 *
 * `checklistCheckedSet` is the app's own helper. Checklist responses have had
 * more than one storage shape over time and it absorbs all of them; parsing
 * that again here is how the two clients would start disagreeing about whether
 * a box was ticked.
 */
export function FormResponseList({
	schema,
	responses,
	checklists,
	compact = false,
	onSave,
}: {
	schema: FormSchema | null;
	responses?: FormResponses | null;
	checklists?: Record<string, Checklist>;
	compact?: boolean;
	/*
	 * Supply this to make EVERY field editable in place. Omit it and the list
	 * is read-only — which is what a schema-less fallback needs, since without
	 * a schema there is no field definition to edit against.
	 */
	onSave?: (
		field: FormField,
		next: unknown,
		previousDisplay: string,
	) => Promise<void>;
}) {
	const values = responses ?? {};

	if (!Object.keys(values).length) {
		return (
			<Text variant="caption" tone="tertiary">
				No answers recorded.
			</Text>
		);
	}

	// With a schema, render in the order the form defines. Without one, fall
	// back to whatever keys exist.
	const rows = schema
		? schema.fields.map((field) => ({
				id: field.id,
				label: field.label,
				type: field.type,
				unit: field.unit,
				checklistId: field.checklistId,
				field,
				value: values[field.id],
			}))
		: Object.keys(values).map((key) => ({
				id: key,
				label: key,
				type: undefined,
				unit: undefined,
				checklistId: undefined,
				field: undefined,
				value: values[key],
			}));

	return (
		<dl className={compact ? styles.listCompact : styles.list}>
			{rows.map((row) => (
				<div key={row.id} className={styles.row}>
					<Text variant="caption" tone="tertiary" as="dt">
						{row.label}
					</Text>
					<dd className={styles.value}>
						{onSave && row.field ? (
							<EditableField
								field={row.field}
								value={row.value}
								checklist={
									row.checklistId
										? checklists?.[row.checklistId]
										: undefined
								}
								onSave={(next, previous) =>
									onSave(row.field!, next, previous)
								}
							/>
						) : (
							<Value
								row={row}
								checklist={
									row.checklistId
										? checklists?.[row.checklistId]
										: undefined
								}
							/>
						)}
					</dd>
				</div>
			))}
		</dl>
	);
}

function Value({
	row,
	checklist,
}: {
	row: {
		type?: string;
		unit?: string;
		value: unknown;
		checklistId?: string;
	};
	checklist?: Checklist;
}) {
	const { value, type, unit } = row;

	if (value === null || value === undefined || value === "") {
		return (
			<Text variant="caption" tone="tertiary" as="span">
				—
			</Text>
		);
	}

	if (type === "checkbox" || typeof value === "boolean") {
		return value ? (
			<Badge tone="success" icon="checkmark">
				Yes
			</Badge>
		) : (
			<Badge tone="neutral">No</Badge>
		);
	}

	if (type === "checklist") {
		const checked = checklistCheckedSet(value);
		const items = checklist?.items ?? [];
		if (!items.length) {
			return (
				<Text variant="body" as="span">
					{checked.size} ticked
				</Text>
			);
		}
		return (
			<ul className={styles.checklist}>
				{items.map((item) => {
					/*
					 * Match on id OR text.
					 *
					 * checklistCheckedSet absorbs three storage shapes that
					 * accumulated over the app's life: `{itemId: true}` maps,
					 * `[{id, text}]` arrays, and plain `["item text"]` arrays.
					 * The last of those only ever yields TEXT, so checking
					 * `item.id` alone silently rendered every box unticked for
					 * entries stored that way.
					 */
					const done = checked.has(item.id) || checked.has(item.text);
					return (
						<li key={item.id} className={styles.checkItem}>
							<Icon
								name={
									done
										? "checkmark-circle"
										: "ellipse-outline"
								}
								size="xs"
								color={
									done
										? "var(--c-success)"
										: "var(--c-text-tertiary)"
								}
							/>
							<Text
								variant="caption"
								as="span"
								tone={done ? "default" : "tertiary"}
							>
								{item.text}
							</Text>
						</li>
					);
				})}
			</ul>
		);
	}

	// Media and document fields store attachment ids, not values.
	if (
		typeof value === "object" &&
		value !== null &&
		"attachmentIds" in value
	) {
		const ids = (value as { attachmentIds: string[] }).attachmentIds ?? [];
		return (
			<Badge tone="neutral" icon="document-outline">
				{ids.length} file{ids.length === 1 ? "" : "s"}
			</Badge>
		);
	}

	if (Array.isArray(value)) {
		return (
			<span className={styles.chips}>
				{value.map((entry, index) => (
					<Badge key={index} tone="neutral">
						{String(entry)}
					</Badge>
				))}
			</span>
		);
	}

	return (
		<Text variant="body" as="span">
			{String(value)}
			{unit ? ` ${unit}` : ""}
		</Text>
	);
}
