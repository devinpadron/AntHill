import type { Checklist, FormField } from "@app/types";
import { Badge, Icon, Text } from "../../ui";
import styles from "./FormPreview.module.css";

/*
 * The form as a worker will see it.
 *
 * Non-interactive on purpose — this answers "does this read sensibly", not
 * "does it submit". A live form here would invite an admin to fill it in and
 * wonder where the answers went.
 *
 * It is the fastest way to catch the two mistakes the builder makes easy: a
 * dropdown with no choices, and a checklist field pointed at nothing.
 */
export function FormPreview({
	draft,
	checklists,
}: {
	draft: {
		title: string;
		description: string;
		isEnabled: boolean;
		fields: FormField[];
	};
	checklists: Checklist[];
}) {
	if (!draft.isEnabled) {
		return (
			<div className={styles.disabled}>
				<Icon name="eye-off-outline" size="md" />
				<Text variant="body" tone="secondary">
					This form is turned off — workers will not be asked it.
				</Text>
			</div>
		);
	}

	if (!draft.fields.length) {
		return (
			<Text variant="caption" tone="tertiary">
				Add a field to see the preview.
			</Text>
		);
	}

	return (
		<div className={styles.phone}>
			<div className={styles.formHead}>
				<Text variant="heading">{draft.title || "Untitled form"}</Text>
				{draft.description && (
					<Text variant="caption" tone="secondary">
						{draft.description}
					</Text>
				)}
			</div>

			{draft.fields.map((field) => (
				<div key={field.id} className={styles.field}>
					<Text variant="label" tone="secondary">
						{field.label || "Untitled field"}
						{field.required && (
							<span className={styles.required}> *</span>
						)}
					</Text>
					<Control field={field} checklists={checklists} />
				</div>
			))}
		</div>
	);
}

function Control({
	field,
	checklists,
}: {
	field: FormField;
	checklists: Checklist[];
}) {
	switch (field.type) {
		case "checkbox":
			return (
				<div className={styles.checkboxRow}>
					<span className={styles.box} />
					<Text variant="body" tone="tertiary" as="span">
						Yes / no
					</Text>
				</div>
			);

		case "select":
		case "multiSelect": {
			const options = field.selectOptions ?? [];
			if (!options.length) {
				return (
					<div className={styles.warn}>
						<Icon name="warning" size="xs" />
						<Text variant="caption" as="span">
							No choices yet — workers will see an empty dropdown.
						</Text>
					</div>
				);
			}
			return (
				<div className={styles.chips}>
					{options.map((option) => (
						<Badge key={option} tone="neutral">
							{option}
						</Badge>
					))}
					{field.type === "multiSelect" && (
						<Text variant="caption" tone="tertiary" as="span">
							pick any
						</Text>
					)}
				</div>
			);
		}

		case "checklist": {
			const checklist = checklists.find(
				(c) => c.id === field.checklistId,
			);
			if (!checklist) {
				return (
					<div className={styles.warn}>
						<Icon name="warning" size="xs" />
						<Text variant="caption" as="span">
							No checklist chosen — this field will show nothing.
						</Text>
					</div>
				);
			}
			return (
				<ul className={styles.checklist}>
					{(checklist.items ?? []).slice(0, 4).map((item) => (
						<li key={item.id} className={styles.checkItem}>
							<span className={styles.box} />
							<Text variant="caption" as="span">
								{item.text}
							</Text>
						</li>
					))}
					{(checklist.items?.length ?? 0) > 4 && (
						<Text variant="caption" tone="tertiary">
							+{(checklist.items?.length ?? 0) - 4} more
						</Text>
					)}
				</ul>
			);
		}

		case "document":
		case "media":
			return (
				<div className={styles.upload}>
					<Icon
						name={
							field.type === "media"
								? "camera-outline"
								: "document-outline"
						}
						size="sm"
					/>
					<Text variant="caption" tone="tertiary" as="span">
						{field.type === "media"
							? "Photo or video"
							: "File upload"}
					</Text>
				</div>
			);

		default:
			return (
				<div className={styles.input}>
					<Text variant="caption" tone="tertiary" as="span">
						{field.placeholder ||
							PLACEHOLDER[field.type] ||
							"Type here"}
					</Text>
					{field.unit && (
						<Text variant="caption" tone="tertiary" as="span">
							{field.unit}
						</Text>
					)}
				</div>
			);
	}
}

const PLACEHOLDER: Record<string, string> = {
	number: "0",
	quantity: "0",
	currency: "0.00",
	date: "Pick a date",
	time: "Pick a time",
};
