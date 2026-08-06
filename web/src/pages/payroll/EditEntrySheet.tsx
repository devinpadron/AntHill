import { useState } from "react";
import { updateTimeEntry } from "@app/services/timeEntryService";
import { appendEdit } from "@app/services/timeEntryEditService";
import { formatDuration } from "@app/utils/timeUtils";
import type { Checklist, FormSchema, TimeEntry } from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Icon,
	Input,
	Select,
	Text,
	Textarea,
	useToast,
} from "../../ui";
import styles from "./EditEntrySheet.module.css";

/*
 * Edit a time entry: the clock times, the notes, and every form answer.
 *
 * The portal previously had no way to change an entry at all — only approve,
 * reject or delete — so a manager who spotted a wrong clock-out had to pick up
 * a phone or open the app.
 *
 * Mirrors src/components/time/EditSheet.tsx, including its admin behaviour:
 * an admin may leave required fields blank and is not forced to write a change
 * summary. A manager fixing an obvious typo should not be interrogated. One
 * summary is still recorded automatically, because the history is the record of
 * who changed what.
 */
export function EditEntrySheet({
	entry,
	schema,
	checklists,
	onClose,
	onSaved,
}: {
	entry: TimeEntry;
	schema: FormSchema | null;
	checklists: Record<string, Checklist>;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { companyId } = useCompany();
	const { userId, user } = useAuth();
	const toast = useToast();

	const [clockIn, setClockIn] = useState(toLocalInput(entry.clockInAt));
	const [clockOut, setClockOut] = useState(toLocalInput(entry.clockOutAt));
	const [pausedMinutes, setPausedMinutes] = useState(
		String(Math.round((entry.pausedSeconds ?? 0) / 60)),
	);
	const [notes, setNotes] = useState(entry.notes ?? "");
	const [responses, setResponses] = useState<Record<string, unknown>>(() => ({
		...(entry.formResponses ?? {}),
	}));
	const [summary, setSummary] = useState("");
	const [saving, setSaving] = useState(false);

	const inDate = clockIn ? new Date(clockIn) : null;
	const outDate = clockOut ? new Date(clockOut) : null;
	const invalid = Boolean(inDate && outDate && outDate <= inDate);

	const workedSeconds =
		inDate && outDate && !invalid
			? Math.max(
					0,
					Math.round((outDate.getTime() - inDate.getTime()) / 1000),
				)
			: (entry.workedSeconds ?? 0);
	const pausedSeconds = Math.max(0, Number(pausedMinutes) || 0) * 60;
	const netSeconds = Math.max(0, workedSeconds - pausedSeconds);

	async function save() {
		if (invalid) return;
		setSaving(true);
		try {
			/*
			 * The `before` block is captured from the entry as it stands, so the
			 * history can show what changed. Recorded before the write, for
			 * obvious reasons.
			 */
			const before = {
				clockInAt: entry.clockInAt ?? null,
				clockOutAt: entry.clockOutAt ?? null,
				workedSeconds: entry.workedSeconds ?? null,
				notes: entry.notes ?? null,
				formResponses: entry.formResponses ?? null,
			};

			const changes: string[] = [];
			if (toLocalInput(entry.clockInAt) !== clockIn)
				changes.push("clock in");
			if (toLocalInput(entry.clockOutAt) !== clockOut)
				changes.push("clock out");
			if ((entry.pausedSeconds ?? 0) !== pausedSeconds)
				changes.push("paused time");
			if ((entry.notes ?? "") !== notes) changes.push("notes");
			if (
				JSON.stringify(entry.formResponses ?? {}) !==
				JSON.stringify(responses)
			) {
				changes.push("form answers");
			}

			if (!changes.length) {
				onClose();
				return;
			}

			await updateTimeEntry(entry.id, {
				...(inDate ? { clockInAt: tsFrom(inDate) } : {}),
				...(outDate ? { clockOutAt: tsFrom(outDate) } : {}),
				workedSeconds,
				pausedSeconds,
				notes,
				formResponses: responses as never,
			} as never);

			await appendEdit(companyId, entry.id, {
				summary: summary.trim() || `Edited ${changes.join(", ")}`,
				actorUserId: userId,
				actorDisplayName: user
					? `${user.firstName} ${user.lastName}`.trim()
					: userId,
				before,
			}).catch(() =>
				console.error("Entry saved but not recorded in history"),
			);

			toast.success("Entry updated");
			onSaved();
			onClose();
		} catch (error) {
			toast.error(
				"Could not save the entry",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			className={styles.scrim}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div
				className={styles.sheet}
				role="dialog"
				aria-modal="true"
				aria-label="Edit time entry"
			>
				<header className={styles.header}>
					<Text variant="heading" as="h2">
						Edit entry
					</Text>
					<button
						className={styles.close}
						onClick={onClose}
						aria-label="Close"
					>
						<Icon name="close" size="sm" />
					</button>
				</header>

				<div className={styles.body}>
					<section className={styles.section}>
						<Text variant="overline" tone="tertiary">
							Times
						</Text>
						<div className={styles.row}>
							<Input
								label="Clocked in"
								type="datetime-local"
								value={clockIn}
								onChange={(e) => setClockIn(e.target.value)}
							/>
							<Input
								label="Clocked out"
								type="datetime-local"
								value={clockOut}
								onChange={(e) => setClockOut(e.target.value)}
								error={
									invalid
										? "Must be after the clock in"
										: undefined
								}
							/>
						</div>
						<div className={styles.row}>
							<Input
								label="Paused (minutes)"
								type="number"
								min={0}
								value={pausedMinutes}
								onChange={(e) =>
									setPausedMinutes(e.target.value)
								}
							/>
							<div className={styles.total}>
								<Text variant="caption" tone="tertiary">
									Net after this edit
								</Text>
								<Text variant="title">
									{formatDuration(netSeconds)}
								</Text>
							</div>
						</div>
					</section>

					<section className={styles.section}>
						<Text variant="overline" tone="tertiary">
							Worker notes
						</Text>
						<Textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={3}
						/>
					</section>

					{schema && schema.fields.length > 0 && (
						<section className={styles.section}>
							<Text variant="overline" tone="tertiary">
								{schema.title || "Form answers"}
							</Text>
							{/*
							 * Required markers are omitted for admins, matching
							 * the app: a manager correcting one number should
							 * not be blocked because a different field the
							 * worker skipped is marked required.
							 */}
							{schema.fields.map((field) => (
								<FieldInput
									key={field.id}
									field={field}
									checklists={checklists}
									value={responses[field.id]}
									onChange={(value) =>
										setResponses((current) => ({
											...current,
											[field.id]: value,
										}))
									}
								/>
							))}
						</section>
					)}

					<section className={styles.section}>
						<Input
							label="What changed? (optional)"
							hint="Recorded in the entry's history. Left blank, one is written for you."
							value={summary}
							onChange={(e) => setSummary(e.target.value)}
							placeholder="e.g. Corrected clock-out — forgot to end shift"
						/>
					</section>
				</div>

				<footer className={styles.footer}>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={save}
						busy={saving}
						disabled={invalid}
					>
						Save changes
					</Button>
				</footer>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------ one field */

function FieldInput({
	field,
	value,
	checklists,
	onChange,
}: {
	field: FormSchema["fields"][number];
	value: unknown;
	checklists: Record<string, Checklist>;
	onChange: (value: unknown) => void;
}) {
	const asString = value === null || value === undefined ? "" : String(value);

	if (field.type === "checkbox") {
		return (
			<label className={styles.checkRow}>
				<input
					type="checkbox"
					checked={Boolean(value)}
					onChange={(e) => onChange(e.target.checked)}
				/>
				<Text variant="body" as="span">
					{field.label}
				</Text>
			</label>
		);
	}

	if (field.type === "select") {
		return (
			<Select
				label={field.label}
				value={asString}
				onChange={(e) => onChange(e.target.value || null)}
			>
				<option value="">—</option>
				{(field.selectOptions ?? []).map((option) => (
					<option key={option} value={option}>
						{option}
					</option>
				))}
			</Select>
		);
	}

	if (field.type === "checklist") {
		const checklist = field.checklistId
			? checklists[field.checklistId]
			: undefined;
		const ticked = new Set(
			Array.isArray(value)
				? (value as string[])
				: Object.entries((value as Record<string, boolean>) ?? {})
						.filter(([, v]) => v)
						.map(([k]) => k),
		);
		return (
			<div className={styles.checklistField}>
				<Text variant="label" tone="secondary">
					{field.label}
				</Text>
				{(checklist?.items ?? []).map((item) => (
					<label key={item.id} className={styles.checkRow}>
						<input
							type="checkbox"
							checked={
								ticked.has(item.id) || ticked.has(item.text)
							}
							onChange={(e) => {
								const next = new Set(ticked);
								if (e.target.checked) next.add(item.id);
								else {
									next.delete(item.id);
									next.delete(item.text);
								}
								// Written as an id map, the shape the current
								// app writes. checklistCheckedSet reads all of
								// the historical shapes on the way back out.
								onChange(
									Object.fromEntries(
										[...next].map((id) => [id, true]),
									),
								);
							}}
						/>
						<Text variant="body" as="span">
							{item.text}
						</Text>
					</label>
				))}
				{!checklist && (
					<Text variant="caption" tone="tertiary">
						This checklist is no longer available.
					</Text>
				)}
			</div>
		);
	}

	if (field.type === "document" || field.type === "media") {
		return (
			<div className={styles.readOnly}>
				<Text variant="label" tone="secondary">
					{field.label}
				</Text>
				<Badge tone="neutral" icon="document-outline">
					Files are edited from the app
				</Badge>
			</div>
		);
	}

	const numeric =
		field.type === "number" ||
		field.type === "currency" ||
		field.type === "quantity";

	return (
		<Input
			label={field.label}
			type={
				field.type === "date"
					? "date"
					: field.type === "time"
						? "time"
						: numeric
							? "number"
							: "text"
			}
			value={asString}
			suffix={field.unit}
			onChange={(e) =>
				onChange(
					numeric
						? e.target.value === ""
							? null
							: Number(e.target.value)
						: e.target.value,
				)
			}
		/>
	);
}

/* ------------------------------------------------------------ timestamps */

/** Firestore Timestamp -> the value a datetime-local input expects (LOCAL). */
function toLocalInput(stamp?: { toDate?: () => Date } | null): string {
	const date = stamp?.toDate?.();
	if (!date) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

/*
 * A plain Date. updateTimeEntry passes the patch straight to Firestore, which
 * converts a Date to a Timestamp itself — so no Timestamp construction is
 * needed here, and importing the SDK into a page would breach the service
 * boundary the layering guard enforces.
 */
const tsFrom = (date: Date) => date;
