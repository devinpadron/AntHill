import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
	getActiveSchema,
	getSchema,
	publishSchema,
} from "@app/services/formSchemaService";
import { subscribeChecklists } from "@app/services/libraryService";
import type {
	Checklist,
	FormField,
	FormFieldType,
	FormSchema,
} from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	Icon,
	Input,
	LoadingPane,
	Text,
	Textarea,
	useToast,
	type IconName,
} from "../../ui";
import { FieldEditor } from "./FieldEditor";
import { FormPreview } from "./FormPreview";
import styles from "./FormEditorPage.module.css";

/*
 * The form schema editor.
 *
 * Schemas are IMMUTABLE and append-only: publishing writes
 * `{companyId}_{kind}_v{n+1}` and repoints the preference at it. Entries
 * already submitted keep the version they were answered against, which is why
 * the payroll detail page can still render a form from three months ago.
 *
 * That makes publishing a bigger deal than saving, so this page does three
 * things the app's editor does not:
 *
 *   - a live PREVIEW of the form as a worker will see it
 *   - a DIFF against the published version, with retypes called out
 *   - a publish button that says what will actually happen
 *
 * NOTE the option field is `selectOptions`, NOT `options`. The layering guard
 * has a rule about this: the editor once wrote `options` while the migration
 * wrote `selectOptions`, and every company silently lost its dropdown choices.
 */

const FIELD_TYPES: {
	type: FormFieldType;
	label: string;
	icon: IconName;
	hint: string;
}[] = [
	{
		type: "text",
		label: "Text",
		icon: "document-text-outline",
		hint: "Free text",
	},
	{
		type: "number",
		label: "Number",
		icon: "calculator-outline",
		hint: "Any number",
	},
	{
		type: "quantity",
		label: "Quantity",
		icon: "albums-outline",
		hint: "Counts, with totals",
	},
	{
		type: "currency",
		label: "Currency",
		icon: "pricetag-outline",
		hint: "Money",
	},
	{ type: "date", label: "Date", icon: "calendar-outline", hint: "A day" },
	{
		type: "time",
		label: "Time",
		icon: "time-outline",
		hint: "A time of day",
	},
	{
		type: "checkbox",
		label: "Checkbox",
		icon: "checkmark-circle-outline",
		hint: "Yes or no",
	},
	{ type: "select", label: "Dropdown", icon: "list", hint: "Pick one" },
	{
		type: "multiSelect",
		label: "Multi-select",
		icon: "options-outline",
		hint: "Pick several",
	},
	{
		type: "checklist",
		label: "Checklist",
		icon: "checkmark",
		hint: "Tick off a saved list",
	},
	{
		type: "document",
		label: "Document",
		icon: "document-outline",
		hint: "File upload",
	},
	{
		type: "media",
		label: "Photo / video",
		icon: "camera-outline",
		hint: "Image or clip",
	},
];

type Draft = {
	title: string;
	description: string;
	isEnabled: boolean;
	fields: FormField[];
};

export function FormEditorPage() {
	const { kind } = useParams<{ kind: "eventForm" | "timeEntryForm" }>();
	const { companyId, preferences } = useCompany();
	const { userId } = useAuth();
	const toast = useToast();

	const [published, setPublished] = useState<FormSchema | null>(null);
	/*
	 * Set when the schema the company is actually USING is not the highest
	 * version that exists. See the loader below — this is a real state in
	 * production, not a theoretical one.
	 */
	const [staleAhead, setStaleAhead] = useState<FormSchema | null>(null);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [checklists, setChecklists] = useState<Checklist[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [dragIndex, setDragIndex] = useState<number | null>(null);

	useEffect(() => subscribeChecklists(companyId, setChecklists), [companyId]);

	/*
	 * WHICH SCHEMA IS "THE" ONE — the pointer, never the highest version.
	 *
	 * `preferences.{kind}SchemaId` is what the app actually renders to workers.
	 * `getActiveSchema` returns max(version), which is a DIFFERENT thing, and
	 * in production the two disagree: migration left several companies with a
	 * higher-numbered schema carrying `fields: []` while their preference still
	 * points at the real one. Loading by max(version) showed those admins an
	 * empty form — and publishing from it would have replaced their live form
	 * with the empty draft.
	 *
	 * So: load the pointer. Fall back to max(version) only when no pointer
	 * exists (a company that has never published), and surface the divergence
	 * when there is one, because the next publish jumps the version number.
	 */
	const pointerId =
		kind === "eventForm"
			? preferences.eventFormSchemaId
			: preferences.timeEntryFormSchemaId;

	useEffect(() => {
		if (!kind) return;
		let live = true;
		setLoading(true);

		(async () => {
			const [byPointer, byVersion] = await Promise.all([
				pointerId ? getSchema(pointerId) : Promise.resolve(null),
				getActiveSchema(companyId, kind),
			]);
			if (!live) return;

			const schema = byPointer ?? byVersion;
			setPublished(schema);

			setStaleAhead(
				byPointer && byVersion && byVersion.version > byPointer.version
					? byVersion
					: null,
			);

			setDraft({
				title: schema?.title ?? defaultTitle(kind),
				description: schema?.description ?? "",
				isEnabled: schema?.isEnabled ?? true,
				fields: schema?.fields ? [...schema.fields] : [],
			});
		})()
			.catch(() => {})
			.finally(() => live && setLoading(false));

		return () => {
			live = false;
		};
	}, [companyId, kind, pointerId]);

	const diff = useMemo(() => {
		if (!draft) return null;
		const before = published?.fields ?? [];
		const after = draft.fields;
		const beforeById = new Map(before.map((f) => [f.id, f]));
		const afterById = new Map(after.map((f) => [f.id, f]));

		return {
			added: after.filter((f) => !beforeById.has(f.id)),
			removed: before.filter((f) => !afterById.has(f.id)),
			renamed: after.filter((f) => {
				const old = beforeById.get(f.id);
				return old && old.label !== f.label;
			}),
			// A retype is the dangerous one: existing answers were stored in
			// the old type's shape and will not necessarily render in the new.
			retyped: after.filter((f) => {
				const old = beforeById.get(f.id);
				return old && old.type !== f.type;
			}),
			reordered:
				before.length === after.length &&
				before.some((f, i) => after[i]?.id !== f.id),
			metaChanged:
				(published?.title ?? defaultTitle(kind!)) !== draft.title ||
				(published?.description ?? "") !== draft.description ||
				(published?.isEnabled ?? true) !== draft.isEnabled,
		};
	}, [published, draft, kind]);

	const dirty =
		diff !== null &&
		(diff.added.length > 0 ||
			diff.removed.length > 0 ||
			diff.renamed.length > 0 ||
			diff.retyped.length > 0 ||
			diff.reordered ||
			diff.metaChanged);

	if (loading || !draft || !kind) return <LoadingPane label="Loading form" />;

	const set = (patch: Partial<Draft>) =>
		setDraft((current) => ({ ...current!, ...patch }));

	function addField(type: FormFieldType) {
		const field: FormField = {
			// Ids must be stable and never reused — an answer is keyed by them.
			id: `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
			label: "",
			type,
			required: false,
			...(type === "select" || type === "multiSelect"
				? { selectOptions: [] }
				: {}),
		};
		set({ fields: [...draft!.fields, field] });
	}

	function updateField(index: number, patch: Partial<FormField>) {
		const next = [...draft!.fields];
		next[index] = { ...next[index], ...patch };
		set({ fields: next });
	}

	function removeField(index: number) {
		set({ fields: draft!.fields.filter((_, i) => i !== index) });
	}

	function moveField(from: number, to: number) {
		if (to < 0 || to >= draft!.fields.length) return;
		const next = [...draft!.fields];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved);
		set({ fields: next });
	}

	const invalid = draft.fields.filter((f) => !f.label.trim());

	async function publish() {
		if (invalid.length) {
			toast.warning(
				"Every field needs a label",
				`${invalid.length} field${invalid.length === 1 ? " has" : "s have"} no label.`,
			);
			return;
		}
		setSaving(true);
		try {
			await publishSchema(
				companyId,
				kind!,
				{
					title: draft!.title.trim(),
					description: draft!.description.trim(),
					isEnabled: draft!.isEnabled,
					fields: draft!.fields,
				},
				userId,
			);
			const next = await getActiveSchema(companyId, kind!);
			setPublished(next);
			toast.success(`Published v${next?.version ?? "?"}`);
		} catch (error) {
			toast.error(
				"Could not publish",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setSaving(false);
		}
	}

	/*
	 * publishSchema numbers from max(version), so when a stale higher version
	 * exists the next id jumps past it rather than colliding. Showing the
	 * number the service will actually use keeps the button honest.
	 */
	const nextVersion =
		Math.max(published?.version ?? 0, staleAhead?.version ?? 0) + 1;

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Text variant="display" as="h1">
						{kind === "eventForm" ? "Event form" : "Timesheet form"}
					</Text>
					<Text variant="caption" tone="secondary">
						{kind === "eventForm"
							? "Asked once per event a worker connects to their time entry."
							: "Asked once when a worker clocks out."}
					</Text>
				</div>
				<div className={styles.headerActions}>
					{published && (
						<Badge tone="neutral" title={published.id}>
							published v{published.version}
						</Badge>
					)}
					<Button
						variant="primary"
						onClick={publish}
						busy={saving}
						disabled={!dirty}
					>
						{dirty ? `Publish v${nextVersion}` : "No changes"}
					</Button>
				</div>
			</header>

			{/*
			 * A higher-numbered schema exists that the company is NOT using.
			 * Migration left several companies in this state. Saying so beats
			 * silently editing one while silently numbering past the other.
			 *
			 * Outside .columns deliberately — that is a three-column grid, and
			 * a notice placed inside it becomes a grid cell.
			 */}
			{staleAhead && (
				<div className={styles.publishNote}>
					<Icon name="information-circle-outline" size="sm" />
					<Text variant="caption" as="span">
						You are editing <strong>v{published?.version}</strong>,
						which is what workers see. A newer{" "}
						<strong>v{staleAhead.version}</strong> exists but is not
						in use — it has {staleAhead.fields.length} field
						{staleAhead.fields.length === 1 ? "" : "s"} and was left
						behind by the data migration. Publishing creates v
						{nextVersion} from what is below.
					</Text>
				</div>
			)}

			<div className={styles.columns}>
				{/* --------------------------------------- palette */}
				<aside className={styles.palette}>
					<Text variant="overline" tone="tertiary">
						Add a field
					</Text>
					<div className={styles.paletteGrid}>
						{FIELD_TYPES.map((entry) => (
							<button
								key={entry.type}
								className={styles.paletteItem}
								onClick={() => addField(entry.type)}
								title={entry.hint}
							>
								<Icon name={entry.icon} size="sm" />
								<Text variant="caption" as="span">
									{entry.label}
								</Text>
							</button>
						))}
					</div>
				</aside>

				{/* ---------------------------------------- builder */}
				<div className={styles.builder}>
					<Card title="Form details">
						<div className={styles.stack}>
							<Input
								label="Title"
								value={draft.title}
								onChange={(e) => set({ title: e.target.value })}
							/>
							<Textarea
								label="Description"
								hint="Shown above the form in the app."
								value={draft.description}
								onChange={(e) =>
									set({ description: e.target.value })
								}
								rows={2}
							/>
							<label className={styles.enabledRow}>
								<input
									type="checkbox"
									checked={draft.isEnabled}
									onChange={(e) =>
										set({ isEnabled: e.target.checked })
									}
								/>
								<span>
									<Text variant="body" as="span">
										Ask this form
									</Text>
									<Text
										variant="caption"
										tone="tertiary"
										as="span"
									>
										Turn off to stop showing it without
										deleting the questions.
									</Text>
								</span>
							</label>
						</div>
					</Card>

					<Card
						title={`Fields (${draft.fields.length})`}
						actions={
							invalid.length > 0 && (
								<Badge tone="danger">
									{invalid.length} missing a label
								</Badge>
							)
						}
					>
						{draft.fields.length === 0 ? (
							<Text variant="caption" tone="tertiary">
								No fields yet — add one from the palette.
							</Text>
						) : (
							<ul className={styles.fieldList}>
								{draft.fields.map((field, index) => (
									<li
										key={field.id}
										draggable
										onDragStart={() => setDragIndex(index)}
										onDragOver={(e) => e.preventDefault()}
										onDrop={() => {
											if (
												dragIndex !== null &&
												dragIndex !== index
											) {
												moveField(dragIndex, index);
											}
											setDragIndex(null);
										}}
										className={
											dragIndex === index
												? styles.dragging
												: undefined
										}
									>
										<FieldEditor
											field={field}
											index={index}
											total={draft.fields.length}
											checklists={checklists}
											isNew={
												!published?.fields.some(
													(f) => f.id === field.id,
												)
											}
											retyped={Boolean(
												diff?.retyped.some(
													(f) => f.id === field.id,
												),
											)}
											onChange={(patch) =>
												updateField(index, patch)
											}
											onRemove={() => removeField(index)}
											onMove={(delta) =>
												moveField(index, index + delta)
											}
										/>
									</li>
								))}
							</ul>
						)}
					</Card>
				</div>

				{/* ------------------------------- preview + diff */}
				<aside className={styles.side}>
					<Card title="What a worker sees">
						<FormPreview draft={draft} checklists={checklists} />
					</Card>

					{dirty && diff && (
						<Card title={`Publishing v${nextVersion}`}>
							<ul className={styles.diffList}>
								{diff.added.map((f) => (
									<DiffLine
										key={`a-${f.id}`}
										tone="success"
										icon="add"
										text={`Adds “${f.label || "untitled"}”`}
									/>
								))}
								{diff.removed.map((f) => (
									<DiffLine
										key={`r-${f.id}`}
										tone="danger"
										icon="close"
										text={`Removes “${f.label}” — existing answers stay on their old version`}
									/>
								))}
								{diff.renamed.map((f) => (
									<DiffLine
										key={`n-${f.id}`}
										tone="neutral"
										icon="pencil"
										text={`Renames a field to “${f.label}”`}
									/>
								))}
								{diff.retyped.map((f) => (
									<DiffLine
										key={`t-${f.id}`}
										tone="warning"
										icon="warning"
										text={`Changes the TYPE of “${f.label}” — answers already given may not render`}
									/>
								))}
								{diff.reordered && (
									<DiffLine
										tone="neutral"
										icon="swap-vertical"
										text="Reorders the fields"
									/>
								)}
								{diff.metaChanged && (
									<DiffLine
										tone="neutral"
										icon="pencil"
										text="Changes the title, description or enabled state"
									/>
								)}
							</ul>

							<div className={styles.publishNote}>
								<Icon
									name="information-circle-outline"
									size="sm"
								/>
								<Text variant="caption" as="span">
									Forms are append-only. Publishing creates v
									{nextVersion} and leaves every entry already
									submitted rendering the version it was
									answered against.
								</Text>
							</div>
						</Card>
					)}
				</aside>
			</div>
		</div>
	);
}

function DiffLine({
	tone,
	icon,
	text,
}: {
	tone: "success" | "danger" | "warning" | "neutral";
	icon: IconName;
	text: string;
}) {
	return (
		<li className={styles.diffLine}>
			<Badge tone={tone} icon={icon}>
				{" "}
			</Badge>
			<Text variant="caption" as="span">
				{text}
			</Text>
		</li>
	);
}

const defaultTitle = (kind: string) =>
	kind === "eventForm" ? "Event details" : "End of shift";
