import { useEffect, useMemo, useState } from "react";
import {
	deleteTaskTemplate,
	saveTaskTemplate,
	subscribeTaskTemplates,
} from "@app/services/eventTaskService";
import { subscribePackages } from "@app/services/libraryService";
import { showConfirmation } from "@app/utils/alertUtils";
import {
	ASSIGNEE_MODE_HINT,
	ASSIGNEE_MODE_LABEL,
	MAX_REMINDER_RULES,
	describeOffset,
	describeReminderRule,
	newReminderRule,
	offsetToParts,
	partsToOffset,
	repeatGapSeconds,
	type OffsetDirection,
	type OffsetUnit,
} from "@app/utils/eventTaskUtils";
import {
	defaultTaskTemplate,
	type Package,
	type TaskAnchor,
	type TaskAssigneeMode,
	type TaskReminderRule,
	type TaskTemplate,
} from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import { Button, Icon, Input, Select, Text, useToast } from "../../ui";
import { TwoPane, asMessage } from "./LibraryPages";
import library from "./LibraryPages.module.css";
import styles from "./TasksPage.module.css";

/*
 * The task library — the portal's counterpart to the app's TaskTemplates
 * screen, writing the same documents through the same service.
 *
 * A fourth tenant of the two-pane library layout, alongside checklists,
 * packages and labels, and it saves the way they do: each field as it changes,
 * no draft and no Save button.
 *
 * It writes a PATCH — the id plus the field that changed — where its
 * neighbours spread the whole selected document back. With `merge: true`
 * underneath that is all a field edit needs, and it means two admins editing
 * different fields of one task cannot overwrite each other.
 *
 * A template is a rule, not a schedule: every time here is relative to
 * whichever event the task ends up on. Editing one changes events it is
 * attached to from then on; tasks already on an event keep the rules they were
 * created with.
 */

const MODES: TaskAssigneeMode[] = ["anyone", "everyone", "specific"];

/** "Anyone on the crew · due 1 day before the event starts". */
const summarize = (template: TaskTemplate) =>
	`${ASSIGNEE_MODE_LABEL[template.assigneeMode ?? "anyone"]} · due ${describeOffset(
		template.dueAnchor ?? "eventStart",
		template.dueOffsetSeconds ?? 0,
	)}`;

export function TasksPage() {
	const { companyId } = useCompany();
	const toast = useToast();
	const [templates, setTemplates] = useState<TaskTemplate[]>([]);
	const [packages, setPackages] = useState<Package[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(
		() => subscribeTaskTemplates(companyId, setTemplates),
		[companyId],
	);
	useEffect(() => subscribePackages(companyId, setPackages), [companyId]);

	const selected = templates.find((t) => t.id === selectedId) ?? null;

	const usedBy = useMemo(
		() =>
			packages.filter((pkg) =>
				(pkg.taskTemplateIds ?? []).includes(selectedId ?? ""),
			),
		[packages, selectedId],
	);

	async function create() {
		setBusy(true);
		try {
			const id = await saveTaskTemplate(companyId, {
				...defaultTaskTemplate,
				title: "New task",
			});
			setSelectedId(id);
		} catch (error) {
			toast.error("Could not create", asMessage(error));
		} finally {
			setBusy(false);
		}
	}

	/** Moves the field locally at once; the subscription confirms it. */
	function edit(patch: Partial<TaskTemplate>) {
		if (!selected) return;
		setTemplates((current) =>
			current.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)),
		);
	}

	async function save(patch: Partial<TaskTemplate>) {
		if (!selected) return;
		edit(patch);
		try {
			await saveTaskTemplate(companyId, { id: selected.id, ...patch });
		} catch (error) {
			toast.error("Could not save", asMessage(error));
		}
	}

	function remove() {
		if (!selected) return;
		showConfirmation(
			`Delete “${selected.title}”?`,
			[
				usedBy.length
					? `${usedBy.length} package${usedBy.length === 1 ? " uses" : "s use"} it and will stop adding it to new events.`
					: null,
				"Events that already have this task keep it, with its reminders. It cannot be undone.",
			]
				.filter(Boolean)
				.join(" "),
			() => {
				void deleteTaskTemplate(selected.id)
					.then(() => {
						setSelectedId(null);
						toast.success("Task deleted");
					})
					.catch((error) =>
						toast.error("Could not delete", asMessage(error)),
					);
			},
			"Delete",
			"destructive",
		);
	}

	const reminders = selected?.reminders ?? [];

	const saveRule = (ruleId: string, patch: Partial<TaskReminderRule>) =>
		void save({
			reminders: reminders.map((rule) =>
				rule.id === ruleId ? { ...rule, ...patch } : rule,
			),
		});

	return (
		<TwoPane
			title="Tasks"
			subtitle="Things the crew must do and confirm on an event, with reminders until it's done. Attach them through a package or straight onto an event."
			items={templates.map((t) => ({
				id: t.id,
				label: t.title,
				meta: summarize(t),
			}))}
			selectedId={selectedId}
			onSelect={setSelectedId}
			onCreate={create}
			creating={busy}
			emptyTitle="No tasks yet"
			emptyHint="Create one — a final call with the client, a photo of the finished setup."
		>
			{selected && (
				<div className={library.editor}>
					<div className={library.editorHead}>
						<Input
							value={selected.title}
							onChange={(e) => edit({ title: e.target.value })}
							onBlur={(e) =>
								void save({ title: e.target.value.trim() })
							}
							aria-label="Task name"
						/>
						<Button
							variant="ghost"
							size="small"
							icon="trash-outline"
							onClick={remove}
						>
							Delete
						</Button>
					</div>

					{usedBy.length > 0 && (
						<div className={library.usage}>
							<Icon name="albums-outline" size="sm" />
							<Text variant="caption" as="span">
								Used by {usedBy.map((p) => p.title).join(", ")}
							</Text>
						</div>
					)}

					<Input
						label="Details"
						placeholder="What to cover, who to ask for…"
						value={selected.description ?? ""}
						onChange={(e) => edit({ description: e.target.value })}
						onBlur={(e) =>
							void save({ description: e.target.value.trim() })
						}
					/>

					{/* ------------------------------------------ who */}
					<div className={styles.block}>
						<Text variant="overline" tone="tertiary">
							Who does it
						</Text>
						<div className={styles.modes}>
							{MODES.map((mode) => (
								<label key={mode} className={styles.mode}>
									<input
										type="radio"
										name="assigneeMode"
										checked={selected.assigneeMode === mode}
										onChange={() =>
											void save({ assigneeMode: mode })
										}
									/>
									<span className={styles.modeText}>
										<Text variant="body" as="span">
											{ASSIGNEE_MODE_LABEL[mode]}
										</Text>
										<Text
											variant="caption"
											tone="tertiary"
											as="span"
										>
											{ASSIGNEE_MODE_HINT[mode]}
										</Text>
									</span>
								</label>
							))}
						</div>
					</div>

					{/* ------------------------------------------ due */}
					<div className={styles.block}>
						<div className={styles.blockHead}>
							<Text variant="overline" tone="tertiary">
								Due
							</Text>
							<Text variant="caption" tone="tertiary">
								{describeOffset(
									selected.dueAnchor,
									selected.dueOffsetSeconds,
								)}
							</Text>
						</div>
						<OffsetFields
							anchor={selected.dueAnchor}
							offsetSeconds={selected.dueOffsetSeconds}
							onChange={({ anchor, offsetSeconds }) =>
								void save({
									dueAnchor: anchor,
									dueOffsetSeconds: offsetSeconds,
								})
							}
						/>
					</div>

					<label className={styles.toggle}>
						<input
							type="checkbox"
							checked={Boolean(selected.requireNote)}
							onChange={(e) =>
								void save({ requireNote: e.target.checked })
							}
						/>
						<span className={styles.modeText}>
							<Text variant="body" as="span">
								Ask for a note
							</Text>
							<Text variant="caption" tone="tertiary" as="span">
								Workers must write something when they tick it —
								what the client said, say.
							</Text>
						</span>
					</label>

					{/* ------------------------------------ reminders */}
					<div className={styles.block}>
						<div className={styles.blockHead}>
							<Text variant="overline" tone="tertiary">
								Reminders ({reminders.length})
							</Text>
							<Text variant="caption" tone="tertiary">
								Sent to whoever still hasn't done it. They stop
								once it's ticked, and a week after the event at
								the latest.
							</Text>
						</div>

						{reminders.map((rule, index) => (
							<RuleEditor
								key={rule.id}
								index={index}
								rule={rule}
								onChange={(patch) => saveRule(rule.id, patch)}
								onRemove={() =>
									void save({
										reminders: reminders.filter(
											(r) => r.id !== rule.id,
										),
									})
								}
							/>
						))}

						{reminders.length < MAX_REMINDER_RULES ? (
							<div>
								<Button
									variant="secondary"
									size="small"
									icon="add"
									onClick={() =>
										void save({
											reminders: [
												...reminders,
												newReminderRule(),
											],
										})
									}
								>
									Add a reminder
								</Button>
							</div>
						) : (
							<Text variant="caption" tone="tertiary">
								{MAX_REMINDER_RULES} is the most one task can
								have.
							</Text>
						)}
					</div>

					{/* -------------------------------------- overdue */}
					<div className={styles.block}>
						<label className={styles.toggle}>
							<input
								type="checkbox"
								checked={selected.overdueAlertSeconds !== null}
								onChange={(e) =>
									void save({
										overdueAlertSeconds: e.target.checked
											? 0
											: null,
									})
								}
							/>
							<span className={styles.modeText}>
								<Text variant="body" as="span">
									Tell managers if it's overdue
								</Text>
								<Text
									variant="caption"
									tone="tertiary"
									as="span"
								>
									One alert when it is still open past its due
									time.
								</Text>
							</span>
						</label>

						{selected.overdueAlertSeconds !== null &&
							selected.overdueAlertSeconds !== undefined && (
								<div className={styles.narrow}>
									<HoursField
										label="Hours after due"
										seconds={selected.overdueAlertSeconds}
										onCommit={(overdueAlertSeconds) =>
											void save({ overdueAlertSeconds })
										}
									/>
								</div>
							)}
					</div>
				</div>
			)}
		</TwoPane>
	);
}

/* ------------------------------------------------------------- pieces */

/**
 * A whole number of hours, committed on blur. Per keystroke would save "2" on
 * the way to typing "24" — and this page saves as it goes.
 */
function HoursField({
	label,
	seconds,
	onCommit,
}: {
	label: string;
	seconds: number;
	onCommit: (seconds: number) => void;
}) {
	const hours = Math.round(seconds / 3600);
	const [text, setText] = useState(String(hours));

	useEffect(() => setText(String(hours)), [hours]);

	return (
		<Input
			label={label}
			type="number"
			min={0}
			value={text}
			onChange={(e) => setText(e.target.value)}
			onBlur={() => {
				const next = Math.max(0, parseInt(text, 10) || 0);
				setText(String(next));
				if (next !== hours) onCommit(next * 3600);
			}}
		/>
	);
}

/**
 * "N hours|days before|after the event starts|ends".
 *
 * Hours and days only — the scheduler runs hourly, so minutes would promise a
 * precision nothing delivers.
 */
function OffsetFields({
	anchor,
	offsetSeconds,
	onChange,
}: {
	anchor: TaskAnchor;
	offsetSeconds: number;
	onChange: (next: { anchor: TaskAnchor; offsetSeconds: number }) => void;
}) {
	const parts = offsetToParts(offsetSeconds);
	const [amount, setAmount] = useState(String(parts.amount));

	useEffect(() => setAmount(String(parts.amount)), [parts.amount]);

	const typed = () => Math.max(0, parseInt(amount, 10) || 0);

	const commit = (next: Partial<typeof parts>) =>
		onChange({
			anchor,
			offsetSeconds: partsToOffset({
				...parts,
				amount: typed(),
				...next,
			}),
		});

	return (
		<div className={styles.offset}>
			<Input
				type="number"
				min={0}
				value={amount}
				onChange={(e) => setAmount(e.target.value)}
				onBlur={() => {
					if (typed() !== parts.amount) commit({});
				}}
				aria-label="How many"
			/>
			<Select
				value={parts.unit}
				onChange={(e) => commit({ unit: e.target.value as OffsetUnit })}
				aria-label="Unit"
			>
				<option value="hours">hours</option>
				<option value="days">days</option>
			</Select>
			<Select
				value={parts.direction}
				onChange={(e) =>
					commit({ direction: e.target.value as OffsetDirection })
				}
				aria-label="Before or after"
			>
				<option value="before">before</option>
				<option value="after">after</option>
			</Select>
			<Select
				value={anchor}
				onChange={(e) =>
					onChange({
						anchor: e.target.value as TaskAnchor,
						offsetSeconds,
					})
				}
				aria-label="Measured from"
			>
				<option value="eventStart">the event starts</option>
				<option value="eventEnd">the event ends</option>
			</Select>
		</div>
	);
}

function RuleEditor({
	index,
	rule,
	onChange,
	onRemove,
}: {
	index: number;
	rule: TaskReminderRule;
	onChange: (patch: Partial<TaskReminderRule>) => void;
	onRemove: () => void;
}) {
	const repeats = Boolean(rule.repeat?.enabled);
	const gap = repeatGapSeconds(rule.repeat);

	return (
		<div className={styles.rule}>
			<div className={styles.ruleHead}>
				<Text variant="label" tone="secondary">
					Reminder {index + 1}
				</Text>
				<button
					className={styles.removeButton}
					onClick={onRemove}
					aria-label={`Remove reminder ${index + 1}`}
				>
					<Icon name="close" size="xs" />
				</button>
			</div>

			<OffsetFields
				anchor={rule.anchor}
				offsetSeconds={rule.offsetSeconds}
				onChange={onChange}
			/>

			<div className={styles.repeat}>
				<label className={styles.toggle}>
					<input
						type="checkbox"
						checked={repeats}
						onChange={(e) =>
							onChange({
								repeat: {
									enabled: e.target.checked,
									// A real gap rather than zero, which would
									// read as "does not repeat" after all.
									hours:
										rule.repeat?.hours ||
										(e.target.checked ? 24 : 0),
									minutes: 0,
								},
							})
						}
					/>
					<Text variant="body" as="span">
						Keep reminding until done
					</Text>
				</label>

				{repeats && (
					<div className={styles.narrow}>
						<HoursField
							label="Every (hours)"
							seconds={(rule.repeat?.hours ?? 0) * 3600}
							onCommit={(seconds) =>
								onChange({
									repeat: {
										enabled: true,
										hours: seconds / 3600,
										minutes: 0,
									},
								})
							}
						/>
					</div>
				)}
			</div>

			<Text variant="caption" tone="tertiary">
				{repeats && !gap
					? "Set an interval — at zero, it is sent once."
					: `Sent ${describeReminderRule(rule)}.`}
			</Text>
		</div>
	);
}
