import { useEffect, useRef, useState } from "react";
import type { Checklist, FormField } from "@app/types";
import { Badge, Icon, Text, useToast } from "../../ui";
import styles from "./EditableField.module.css";

/*
 * Any form answer, editable where it is displayed.
 *
 * There is no longer a per-field opt-in. `quickEditPayroll` used to gate this,
 * which meant a manager reviewing payroll could correct one figure and not the
 * one beside it, for reasons invisible on screen. Everything an admin is
 * allowed to change is changed in place.
 *
 * SAVES ON BLUR, not per keystroke. Per-keystroke writes would mean a Firestore
 * write and an edit-history entry per character, and the history is the record
 * of who changed what — it has to stay readable.
 *
 * The caller supplies `onSave`, so the same control serves a time entry's own
 * answers and a connected event's, which live in different documents and are
 * written by different services.
 */
export function EditableField({
	field,
	value,
	checklist,
	onSave,
}: {
	field: FormField;
	value: unknown;
	checklist?: Checklist;
	/** Persist the new value. Rejecting reverts the input. */
	onSave: (next: unknown, previousDisplay: string) => Promise<void>;
}) {
	const toast = useToast();
	const [saving, setSaving] = useState(false);

	const numeric =
		field.type === "number" ||
		field.type === "currency" ||
		field.type === "quantity";

	/* ---------- non-text types commit immediately, no blur to wait for ---- */

	async function commitDirect(next: unknown, previous: string) {
		setSaving(true);
		try {
			await onSave(next, previous);
		} catch (error) {
			toast.error(
				"Could not save that",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setSaving(false);
		}
	}

	if (field.type === "checkbox") {
		return (
			<label className={styles.inlineCheck}>
				<input
					type="checkbox"
					checked={Boolean(value)}
					disabled={saving}
					onChange={(e) =>
						commitDirect(e.target.checked, value ? "Yes" : "No")
					}
				/>
				<Text variant="caption" as="span">
					{value ? "Yes" : "No"}
				</Text>
			</label>
		);
	}

	if (field.type === "select") {
		return (
			<select
				className={styles.select}
				value={
					value === null || value === undefined ? "" : String(value)
				}
				disabled={saving}
				onChange={(e) =>
					commitDirect(e.target.value || null, String(value ?? "—"))
				}
			>
				<option value="">—</option>
				{(field.selectOptions ?? []).map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</select>
		);
	}

	if (field.type === "checklist") {
		const ticked = new Set(
			Array.isArray(value)
				? (value as string[])
				: Object.entries((value as Record<string, boolean>) ?? {})
						.filter(([, v]) => v)
						.map(([k]) => k),
		);
		const items = checklist?.items ?? [];
		if (!items.length) {
			return (
				<Text variant="caption" tone="tertiary" as="span">
					{ticked.size} ticked
				</Text>
			);
		}
		return (
			<ul className={styles.checklist}>
				{items.map((item) => {
					const done = ticked.has(item.id) || ticked.has(item.text);
					return (
						<li key={item.id}>
							<label className={styles.inlineCheck}>
								<input
									type="checkbox"
									checked={done}
									disabled={saving}
									onChange={() => {
										const next = new Set(ticked);
										if (done) {
											next.delete(item.id);
											next.delete(item.text);
										} else next.add(item.id);
										commitDirect(
											Object.fromEntries(
												[...next].map((id) => [
													id,
													true,
												]),
											),
											`${ticked.size} ticked`,
										);
									}}
								/>
								<Text
									variant="caption"
									as="span"
									tone={done ? "default" : "tertiary"}
								>
									{item.text}
								</Text>
							</label>
						</li>
					);
				})}
			</ul>
		);
	}

	// Files are uploaded and removed from the app, not corrected in a table.
	if (field.type === "document" || field.type === "media") {
		const ids =
			typeof value === "object" &&
			value !== null &&
			"attachmentIds" in value
				? ((value as { attachmentIds: string[] }).attachmentIds ?? [])
				: [];
		return (
			<Badge tone="neutral" icon="document-outline">
				{ids.length} file{ids.length === 1 ? "" : "s"}
			</Badge>
		);
	}

	return (
		<TextLike
			field={field}
			value={value}
			numeric={numeric}
			saving={saving}
			setSaving={setSaving}
			onSave={onSave}
		/>
	);
}

/* --------------------------------------------------- text / number / date */

function TextLike({
	field,
	value,
	numeric,
	saving,
	setSaving,
	onSave,
}: {
	field: FormField;
	value: unknown;
	numeric: boolean;
	saving: boolean;
	setSaving: (v: boolean) => void;
	onSave: (next: unknown, previousDisplay: string) => Promise<void>;
}) {
	const toast = useToast();
	const initial = value === null || value === undefined ? "" : String(value);
	const [draft, setDraft] = useState(initial);
	const committed = useRef(initial);

	// Re-seed when the underlying value changes, but never mid-edit — that
	// would erase what the admin is typing.
	useEffect(() => {
		if (draft === committed.current) {
			setDraft(initial);
			committed.current = initial;
		}
	}, [initial]);

	async function commit() {
		const next = draft.trim();
		if (next === committed.current) return;

		if (numeric && next !== "" && Number.isNaN(Number(next))) {
			toast.warning("That is not a number", "The change was not saved.");
			setDraft(committed.current);
			return;
		}

		setSaving(true);
		try {
			await onSave(
				numeric ? (next === "" ? null : Number(next)) : next,
				committed.current,
			);
			committed.current = next;
		} catch (error) {
			toast.error(
				"Could not save that",
				error instanceof Error ? error.message : undefined,
			);
			setDraft(committed.current);
		} finally {
			setSaving(false);
		}
	}

	const dirty = draft.trim() !== committed.current;

	return (
		<span className={styles.wrap}>
			<input
				className={[styles.input, dirty ? styles.dirty : ""]
					.filter(Boolean)
					.join(" ")}
				type={
					field.type === "date"
						? "date"
						: field.type === "time"
							? "time"
							: "text"
				}
				inputMode={numeric ? "decimal" : undefined}
				value={draft}
				disabled={saving}
				placeholder={field.placeholder}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") e.currentTarget.blur();
					if (e.key === "Escape") {
						setDraft(committed.current);
						e.currentTarget.blur();
					}
				}}
				aria-label={field.label}
			/>
			{field.unit && (
				<Text variant="caption" tone="tertiary" as="span">
					{field.unit}
				</Text>
			)}
			{saving && (
				<Icon name="refresh" size="xs" className={styles.spin} />
			)}
			{!saving && dirty && (
				<Text variant="caption" tone="tertiary" as="span">
					unsaved
				</Text>
			)}
		</span>
	);
}
