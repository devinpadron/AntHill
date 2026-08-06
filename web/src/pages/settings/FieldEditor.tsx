import { useState } from "react";
import type { Checklist, FormField } from "@app/types";
import { Badge, Icon, Input, Select, Text } from "../../ui";
import styles from "./FieldEditor.module.css";

/*
 * One field in the form builder.
 *
 * Collapsed, a row summarises itself — type, label, required, and whatever is
 * type-specific ("3 options", "× 1.5", "Checklist: Setup"). At a dozen fields
 * that summary is the difference between scanning a form and reading it.
 *
 * The options field is `selectOptions`. Not `options`. The layering guard
 * enforces this because the two once disagreed and every company silently lost
 * its dropdown choices.
 */
export function FieldEditor({
	field,
	index,
	total,
	checklists,
	isNew,
	retyped,
	onChange,
	onRemove,
	onMove,
}: {
	field: FormField;
	index: number;
	total: number;
	checklists: Checklist[];
	isNew: boolean;
	retyped: boolean;
	onChange: (patch: Partial<FormField>) => void;
	onRemove: () => void;
	onMove: (delta: number) => void;
}) {
	const [open, setOpen] = useState(!field.label);

	const numeric =
		field.type === "number" ||
		field.type === "quantity" ||
		field.type === "currency";
	const hasOptions = field.type === "select" || field.type === "multiSelect";

	return (
		<div
			className={[styles.wrap, open ? styles.wrapOpen : ""]
				.filter(Boolean)
				.join(" ")}
		>
			<div className={styles.head}>
				<span className={styles.grip} title="Drag to reorder">
					<Icon name="swap-vertical" size="sm" />
				</span>

				<button
					className={styles.summary}
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
				>
					<Text
						variant="bodyStrong"
						as="span"
						clamp={1}
						tone={field.label ? "default" : "tertiary"}
					>
						{field.label || "Untitled field"}
					</Text>
					<span className={styles.badges}>
						<Badge tone="neutral">{field.type}</Badge>
						{field.required && (
							<Badge tone="accent">required</Badge>
						)}
						{isNew && <Badge tone="success">new</Badge>}
						{retyped && (
							<Badge tone="warning" icon="warning">
								retyped
							</Badge>
						)}
						{hasOptions && (
							<Badge tone="neutral">
								{field.selectOptions?.length ?? 0} options
							</Badge>
						)}
						{field.useMultiplier && field.multiplier && (
							<Badge tone="neutral">× {field.multiplier}</Badge>
						)}
						{field.checklistId && (
							<Badge tone="neutral">
								{checklists.find(
									(c) => c.id === field.checklistId,
								)?.title ?? "checklist"}
							</Badge>
						)}
					</span>
					<Icon
						name={open ? "chevron-up" : "chevron-down"}
						size="sm"
					/>
				</button>

				<div className={styles.rowActions}>
					<button
						className={styles.iconButton}
						onClick={() => onMove(-1)}
						disabled={index === 0}
						aria-label="Move up"
					>
						<Icon name="arrow-up" size="xs" />
					</button>
					<button
						className={styles.iconButton}
						onClick={() => onMove(1)}
						disabled={index === total - 1}
						aria-label="Move down"
					>
						<Icon name="arrow-down" size="xs" />
					</button>
					<button
						className={styles.removeButton}
						onClick={onRemove}
						aria-label="Remove field"
					>
						<Icon name="close" size="xs" />
					</button>
				</div>
			</div>

			{open && (
				<div className={styles.body}>
					<div className={styles.row}>
						<Input
							label="Label"
							value={field.label}
							onChange={(e) =>
								onChange({ label: e.target.value })
							}
							error={field.label.trim() ? undefined : "Required"}
							placeholder="What are you asking?"
						/>
						<label className={styles.requiredToggle}>
							<input
								type="checkbox"
								checked={field.required}
								onChange={(e) =>
									onChange({ required: e.target.checked })
								}
							/>
							<Text variant="body" as="span">
								Required
							</Text>
						</label>
					</div>

					{field.type === "text" && (
						<Input
							label="Placeholder"
							value={field.placeholder ?? ""}
							onChange={(e) =>
								onChange({ placeholder: e.target.value })
							}
						/>
					)}

					{/*
					 * There is deliberately no "quick edit" option here.
					 *
					 * It used to gate whether a field could be corrected from
					 * the payroll screen, which meant a manager could fix one
					 * figure and not the one beside it for reasons invisible on
					 * screen. Both clients now make every field editable in
					 * place, so the flag has been removed from FormField
					 * entirely.
					 */}

					{numeric && (
						<>
							<div className={styles.row}>
								<Input
									label="Unit"
									hint="Shown after the number — kg, hrs, trays"
									value={field.unit ?? ""}
									onChange={(e) =>
										onChange({ unit: e.target.value })
									}
								/>
								<label className={styles.requiredToggle}>
									<input
										type="checkbox"
										checked={Boolean(field.showTotal)}
										onChange={(e) =>
											onChange({
												showTotal: e.target.checked,
											})
										}
									/>
									<Text variant="body" as="span">
										Show a total
									</Text>
								</label>
							</div>
							<div className={styles.row}>
								<label className={styles.requiredToggle}>
									<input
										type="checkbox"
										checked={Boolean(field.useMultiplier)}
										onChange={(e) =>
											onChange({
												useMultiplier: e.target.checked,
											})
										}
									/>
									<Text variant="body" as="span">
										Multiply the value
									</Text>
								</label>
								{field.useMultiplier && (
									<Input
										label="Multiplier"
										type="number"
										step="0.01"
										value={String(field.multiplier ?? 1)}
										onChange={(e) =>
											onChange({
												multiplier:
													Number(e.target.value) || 1,
											})
										}
									/>
								)}
							</div>
						</>
					)}

					{hasOptions && (
						<OptionEditor
							options={field.selectOptions ?? []}
							onChange={(selectOptions) =>
								onChange({ selectOptions })
							}
						/>
					)}

					{field.type === "checklist" && (
						<>
							<Select
								label="Checklist"
								value={field.checklistId ?? ""}
								onChange={(e) => {
									const checklist = checklists.find(
										(c) => c.id === e.target.value,
									);
									onChange({
										checklistId:
											e.target.value || undefined,
										checklistName: checklist?.title ?? null,
										checklistItemCount:
											checklist?.items?.length ?? 0,
									});
								}}
							>
								<option value="">Choose one…</option>
								{checklists.map((checklist) => (
									<option
										key={checklist.id}
										value={checklist.id}
									>
										{checklist.title} (
										{checklist.items?.length ?? 0})
									</option>
								))}
							</Select>
							{field.required && (
								<Select
									label="What counts as complete"
									value={
										field.checklistRequiredMode ??
										"atLeastOne"
									}
									onChange={(e) =>
										onChange({
											checklistRequiredMode: e.target
												.value as "atLeastOne" | "all",
										})
									}
								>
									<option value="atLeastOne">
										At least one item ticked
									</option>
									<option value="all">
										Every item ticked
									</option>
								</Select>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

function OptionEditor({
	options,
	onChange,
}: {
	options: string[];
	onChange: (next: string[]) => void;
}) {
	const [draft, setDraft] = useState("");

	return (
		<div className={styles.options}>
			<Text variant="label" tone="secondary">
				Choices
			</Text>

			{options.length > 0 && (
				<ul className={styles.optionList}>
					{options.map((option, index) => (
						<li key={index} className={styles.optionRow}>
							<Text variant="body" as="span" clamp={1}>
								{option}
							</Text>
							<button
								className={styles.removeButton}
								onClick={() =>
									onChange(
										options.filter((_, i) => i !== index),
									)
								}
								aria-label={`Remove ${option}`}
							>
								<Icon name="close" size="xs" />
							</button>
						</li>
					))}
				</ul>
			)}

			<Input
				placeholder="Add a choice and press Enter"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key !== "Enter") return;
					e.preventDefault();
					const value = draft.trim();
					if (!value || options.includes(value)) return;
					onChange([...options, value]);
					setDraft("");
				}}
			/>
		</div>
	);
}
