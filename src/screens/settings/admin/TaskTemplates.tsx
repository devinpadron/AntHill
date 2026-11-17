import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useUser } from "../../../contexts/UserContext";
import { useTaskTemplates } from "../../../hooks/useTaskTemplates";
import { useCompanyMembers } from "../../../hooks/useCompanyMembers";
import { useExitGuard } from "../../../hooks/useExitGuard";
import {
	deleteTaskTemplate,
	saveTaskTemplate,
} from "../../../services/eventTaskService";
import { subscribePackages } from "../../../services/libraryService";
import { showConfirmation } from "../../../utils/alertUtils";
import {
	ASSIGNEE_MODE_HINT,
	ASSIGNEE_MODE_LABEL,
	MAX_REMINDER_RULES,
	describeOffset,
	describeReminderRule,
	newReminderRule,
	offsetToParts,
	OffsetUnit,
	partsToOffset,
	repeatGapSeconds,
} from "../../../utils/eventTaskUtils";
import {
	defaultTaskTemplate,
	Package,
	Role,
	TaskAssigneeMode,
	TaskReminderRule,
	TaskTemplate,
} from "../../../types";
import {
	Badge,
	Button,
	Card,
	Checkbox,
	EmptyState,
	IconButton,
	Input,
	ListRow,
	Screen,
	ScreenFooter,
	ScreenHeader,
	SegmentedControl,
	SkeletonList,
	Text,
	toast,
	Toggle,
} from "../../../components/ui";
import { TaskOffsetEditor } from "../../../components/tasks/TaskOffsetEditor";
import { PersonPicker } from "../../../components/eventSubmit/PersonPicker";
import { Theme, useThemedStyles } from "../../../theme";

/*
 * The task library: things a manager wants done and confirmed on an event,
 * with a due time and reminders until it is.
 *
 * One screen, two states — the list, and the editor for one template — the
 * same arrangement as checklists and packages, so a manager who has used
 * either already knows where everything is.
 *
 * A template is a RULE, not a schedule. Nothing here names a date: every time
 * is relative to whichever event the task ends up attached to, which is what
 * lets one "Final client call" serve every wedding on the calendar. Editing a
 * template changes events it is attached to from then on; tasks already on
 * an event keep the rules they were created with.
 */

type Draft = Pick<
	TaskTemplate,
	| "title"
	| "description"
	| "assigneeMode"
	| "dueAnchor"
	| "dueOffsetSeconds"
	| "requireNote"
	| "reminders"
	| "dueWarningSeconds"
	| "overdueAlertSeconds"
	| "overdueAlertRepeatSeconds"
	| "overdueAlertUserIds"
> & { id?: string };

const MODES: TaskAssigneeMode[] = ["anyone", "everyone", "specific"];

const toDraft = (template: TaskTemplate): Draft => ({
	id: template.id,
	title: template.title ?? "",
	description: template.description ?? "",
	assigneeMode: template.assigneeMode ?? "anyone",
	dueAnchor: template.dueAnchor ?? "eventStart",
	dueOffsetSeconds: template.dueOffsetSeconds ?? 0,
	requireNote: Boolean(template.requireNote),
	reminders: template.reminders ?? [],
	dueWarningSeconds: template.dueWarningSeconds ?? null,
	overdueAlertSeconds: template.overdueAlertSeconds ?? null,
	overdueAlertRepeatSeconds: template.overdueAlertRepeatSeconds ?? null,
	overdueAlertUserIds: template.overdueAlertUserIds ?? [],
});

/** "2 hours", "1 day" — for the sentence under the alert's settings. */
const describeSpan = (seconds: number): string => {
	const { amount, unit } = offsetToParts(seconds);
	return `${amount} ${amount === 1 ? unit.slice(0, -1) : unit}`;
};

/** "Anyone on the crew · due 1 day before the event starts · 2 reminders". */
const summarize = (template: TaskTemplate): string => {
	const reminders = template.reminders?.length ?? 0;
	return [
		ASSIGNEE_MODE_LABEL[template.assigneeMode ?? "anyone"],
		`due ${describeOffset(
			template.dueAnchor ?? "eventStart",
			template.dueOffsetSeconds ?? 0,
		)}`,
		reminders
			? `${reminders} ${reminders === 1 ? "reminder" : "reminders"}`
			: "no reminders",
	].join(" · ");
};

const TaskTemplates = ({ navigation }) => {
	const styles = useThemedStyles(taskTemplateStyles);
	const { companyId } = useUser();
	const { templates, isLoading } = useTaskTemplates(companyId ?? "");
	const { members, isLoading: membersLoading } = useCompanyMembers(
		companyId ?? "",
	);

	/*
	 * Who an overdue alert can be addressed to: managers and owners, the only
	 * people the scheduler will send it to. A worker named here would simply
	 * never hear anything, so they are not offered.
	 */
	const managerOptions = useMemo(
		() =>
			members
				.filter((m) => m.role === Role.MANAGER || m.role === Role.OWNER)
				.map((m) => ({ id: m.userId, label: m.displayName })),
		[members],
	);

	const [packages, setPackages] = useState<Package[]>([]);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [titleError, setTitleError] = useState<string>();

	// Only for saying what a delete would affect.
	useEffect(() => {
		if (!companyId) return;
		return subscribePackages(companyId, setPackages);
	}, [companyId]);

	const usedBy = useMemo(
		() =>
			draft?.id
				? packages.filter((pkg) =>
						(pkg.taskTemplateIds ?? []).includes(draft.id!),
					)
				: [],
		[packages, draft?.id],
	);

	const change = (patch: Partial<Draft>) => {
		setDraft((current) => (current ? { ...current, ...patch } : current));
		setDirty(true);
	};

	const changeRule = (ruleId: string, patch: Partial<TaskReminderRule>) =>
		change({
			reminders: (draft?.reminders ?? []).map((rule) =>
				rule.id === ruleId ? { ...rule, ...patch } : rule,
			),
		});

	const open = (next: Draft) => {
		setDraft(next);
		setDirty(false);
		setTitleError(undefined);
	};

	const close = () => {
		setDraft(null);
		setDirty(false);
	};

	const handleBack = () => {
		if (!draft) return navigation.goBack();
		if (!dirty) return close();

		Alert.alert("Discard changes?", "This task has unsaved changes.", [
			{ text: "Keep editing", style: "cancel" },
			{ text: "Discard", style: "destructive", onPress: close },
		]);
	};

	// The header arrow already asks before closing the editor. The Android back
	// button and the edge swipe leave the whole screen instead, and used to
	// take the draft with them unasked.
	useExitGuard(navigation, {
		isDirty: !!draft && dirty,
		message: "This task has unsaved changes.",
	});

	const save = async () => {
		if (!draft || !companyId) return;

		if (!draft.title.trim()) {
			setTitleError("Give the task a name.");
			toast.warning("The task needs a name");
			return;
		}

		setSaving(true);
		try {
			/*
			 * Someone picked for the alert who has since left or been made a
			 * worker is dropped here. Left in, they would be an invisible
			 * selection — the picker only lists current managers — and once the
			 * rest were unticked the task would look addressed to "everyone"
			 * on screen while still naming them underneath. Skipped while the
			 * roster is loading, when "not in the list" means nothing.
			 */
			const managerIds = new Set(managerOptions.map((o) => o.id));
			const alertUserIds = draft.overdueAlertUserIds ?? [];

			await saveTaskTemplate(companyId, {
				...draft,
				title: draft.title.trim(),
				description: draft.description.trim(),
				overdueAlertUserIds: membersLoading
					? alertUserIds
					: alertUserIds.filter((id) => managerIds.has(id)),
			});
			toast.success(draft.id ? "Task saved" : "Task created");
			close();
		} catch (error) {
			console.error("Error saving task template:", error);
			toast.error("Could not save the task", "Please try again.");
		} finally {
			setSaving(false);
		}
	};

	const remove = () => {
		if (!draft?.id) return;
		const id = draft.id;

		showConfirmation(
			`Delete "${draft.title.trim() || "this task"}"?`,
			[
				usedBy.length
					? `${usedBy.length} ${usedBy.length === 1 ? "package uses" : "packages use"} it and will stop adding it to new events.`
					: null,
				"Events that already have this task keep it, with its reminders. It cannot be undone.",
			]
				.filter(Boolean)
				.join(" "),
			() => {
				void (async () => {
					try {
						await deleteTaskTemplate(id);
						toast.success("Task deleted");
						close();
					} catch (error) {
						console.error("Error deleting task template:", error);
						toast.error("Could not delete the task");
					}
				})();
			},
			"Delete",
			"destructive",
		);
	};

	/* ------------------------------------------------------------- editor */

	if (draft) {
		const alertOn = draft.overdueAlertSeconds !== null;
		const warning = draft.dueWarningSeconds ?? 0;
		const warningOn = warning > 0;
		const alertRepeat = draft.overdueAlertRepeatSeconds ?? 0;
		const alertUserIds = draft.overdueAlertUserIds ?? [];
		const alertNames = managerOptions
			.filter((o) => alertUserIds.includes(o.id))
			.map((o) => o.label);

		return (
			<Screen
				scroll
				padded
				keyboard="aware"
				header={
					<ScreenHeader
						title={draft.id ? "Edit task" : "New task"}
						onBack={handleBack}
						actions={
							draft.id
								? [
										{
											icon: "trash-outline",
											label: "Delete task",
											color: "danger",
											onPress: remove,
										},
									]
								: []
						}
					/>
				}
				footer={
					<ScreenFooter safeArea>
						<Button
							title={draft.id ? "Save changes" : "Create task"}
							icon="checkmark"
							onPress={save}
							fullWidth
							size="large"
							haptic="press"
							loading={saving}
							disabled={saving}
						/>
					</ScreenFooter>
				}
			>
				<Card title="What needs doing" style={styles.card}>
					<Input
						label="Task"
						placeholder="Final call with the client"
						value={draft.title}
						onChangeText={(title) => {
							change({ title });
							if (titleError) setTitleError(undefined);
						}}
						error={titleError}
						containerStyle={styles.field}
					/>
					<Input
						label="Details (optional)"
						placeholder="What to cover, who to ask for…"
						multiline
						value={draft.description}
						onChangeText={(description) => change({ description })}
					/>
				</Card>

				<Card title="Who does it" style={styles.card}>
					{MODES.map((mode) => (
						<Checkbox
							key={mode}
							radio
							checked={draft.assigneeMode === mode}
							onPress={() => change({ assigneeMode: mode })}
							label={ASSIGNEE_MODE_LABEL[mode]}
							description={ASSIGNEE_MODE_HINT[mode]}
						/>
					))}
				</Card>

				<Card title="Due" style={styles.card}>
					<TaskOffsetEditor
						anchor={draft.dueAnchor}
						offsetSeconds={draft.dueOffsetSeconds}
						onChange={({ anchor, offsetSeconds }) =>
							change({
								dueAnchor: anchor,
								dueOffsetSeconds: offsetSeconds,
							})
						}
					/>
					<Text
						variant="caption"
						color="textSecondary"
						style={styles.summary}
					>
						Due{" "}
						{describeOffset(
							draft.dueAnchor,
							draft.dueOffsetSeconds,
						)}
						.
					</Text>
				</Card>

				<Card flush style={styles.card}>
					<ListRow
						multiline
						title="Ask for a note"
						subtitle="Workers must write something when they tick it"
						icon="create-outline"
						separator={false}
						accessory={
							<Toggle
								value={draft.requireNote}
								onValueChange={(requireNote) =>
									change({ requireNote })
								}
							/>
						}
					/>
				</Card>

				<Card
					title="Reminders"
					titleAccessory={
						draft.reminders.length > 0 ? (
							<Badge
								label={String(draft.reminders.length)}
								tone="accent"
							/>
						) : undefined
					}
					style={styles.card}
				>
					<Text
						variant="caption"
						color="textSecondary"
						style={styles.hint}
					>
						Sent to whoever still has not done it. Reminders stop
						the moment the task is ticked, and a week after the
						event at the latest.
					</Text>

					{draft.reminders.map((rule, index) => (
						<ReminderRuleEditor
							key={rule.id}
							index={index}
							rule={rule}
							onChange={(patch) => changeRule(rule.id, patch)}
							onRemove={() =>
								change({
									reminders: draft.reminders.filter(
										(r) => r.id !== rule.id,
									),
								})
							}
						/>
					))}

					{draft.reminders.length < MAX_REMINDER_RULES ? (
						<Button
							title="Add a reminder"
							icon="add"
							variant="secondary"
							onPress={() =>
								change({
									reminders: [
										...draft.reminders,
										newReminderRule(),
									],
								})
							}
						/>
					) : (
						<Text variant="caption" color="textTertiary">
							{MAX_REMINDER_RULES} is the most one task can have.
						</Text>
					)}
				</Card>

				{/*
				 * What managers hear, as opposed to the reminders above, which
				 * go to whoever owes the task. Two independent switches — a
				 * warning while there is still time, an alert once there is
				 * not — and one answer to "who", shared by both.
				 */}
				<Card flush style={styles.card}>
					<ListRow
						multiline
						title="Warn managers before it is due"
						subtitle="A heads-up if nobody has done it yet, while there is still time"
						icon="time-outline"
						accessory={
							<Toggle
								value={warningOn}
								onValueChange={(on) =>
									change({
										dueWarningSeconds: on
											? 24 * 3600
											: null,
									})
								}
							/>
						}
					/>
					{warningOn && (
						<View style={styles.revealed}>
							<Text
								variant="label"
								color="textSecondary"
								uppercase
							>
								How long before it is due
							</Text>
							<SpanInput
								min={1}
								accessibilityLabel="How long before it is due"
								seconds={warning}
								onChange={(dueWarningSeconds) =>
									change({ dueWarningSeconds })
								}
							/>
						</View>
					)}
					<ListRow
						multiline
						title="Tell managers if it is overdue"
						subtitle="An alert when it is still open past its due time"
						icon="alert-circle-outline"
						separator={alertOn || warningOn}
						accessory={
							<Toggle
								value={alertOn}
								onValueChange={(on) =>
									change({
										overdueAlertSeconds: on ? 0 : null,
									})
								}
							/>
						}
					/>
					{alertOn && (
						<View style={styles.revealed}>
							<Text
								variant="label"
								color="textSecondary"
								uppercase
							>
								How long after it was due
							</Text>
							<SpanInput
								seconds={draft.overdueAlertSeconds ?? 0}
								onChange={(overdueAlertSeconds) =>
									change({ overdueAlertSeconds })
								}
							/>

							<View style={styles.repeatRow}>
								<View style={styles.flex}>
									<Text variant="body">
										Keep alerting until done
									</Text>
								</View>
								<Toggle
									value={alertRepeat > 0}
									onValueChange={(on) =>
										change({
											overdueAlertRepeatSeconds: on
												? 24 * 3600
												: null,
										})
									}
								/>
							</View>
							{alertRepeat > 0 && (
								<SpanInput
									min={1}
									accessibilityLabel="Repeat every"
									seconds={alertRepeat}
									onChange={(overdueAlertRepeatSeconds) =>
										change({ overdueAlertRepeatSeconds })
									}
								/>
							)}
						</View>
					)}
					{(alertOn || warningOn) && (
						<View style={styles.revealed}>
							<Text
								variant="label"
								color="textSecondary"
								uppercase
							>
								{alertOn && warningOn
									? "Who gets them"
									: "Who gets it"}
							</Text>
							<PersonPicker
								options={managerOptions}
								selectedIds={alertUserIds}
								onToggle={(id) =>
									change({
										overdueAlertUserIds:
											alertUserIds.includes(id)
												? alertUserIds.filter(
														(x) => x !== id,
													)
												: [...alertUserIds, id],
									})
								}
								placeholder="Every manager and owner"
								searchPlaceholder="Search managers"
								emptyText="No managers found."
							/>

							{/* The whole rule in one sentence, so nobody has to
							    assemble it from four controls. */}
							<Text variant="caption" color="textSecondary">
								{alertNames.length
									? `Only ${alertNames.join(", ")}`
									: "Every manager and owner"}{" "}
								{alertNames.length > 1 ? "hear" : "hears"} about
								it{" "}
								{[
									warningOn
										? `${describeSpan(warning)} before it is due`
										: null,
									alertOn
										? `${
												draft.overdueAlertSeconds
													? `${describeSpan(draft.overdueAlertSeconds)} after the due time`
													: "as soon as it is past due"
											}${
												alertRepeat > 0
													? `, then every ${describeSpan(alertRepeat)} until it is done`
													: ""
											}`
										: null,
								]
									.filter(Boolean)
									.join(", and again ")}
								. Only while it is still not done, and never
								overnight.
							</Text>
						</View>
					)}
				</Card>
			</Screen>
		);
	}

	/* --------------------------------------------------------------- list */

	const header = (
		<ScreenHeader
			title="Tasks"
			subtitle="Things to do and confirm on an event"
			onBack={handleBack}
		/>
	);

	if (isLoading) {
		return (
			<Screen header={header}>
				<SkeletonList rows={4} />
			</Screen>
		);
	}

	return (
		<Screen
			scroll
			padded
			header={header}
			footer={
				<ScreenFooter safeArea>
					<Button
						title="New task"
						icon="add"
						onPress={() => open({ ...defaultTaskTemplate })}
						fullWidth
						size="large"
					/>
				</ScreenFooter>
			}
		>
			{templates.length === 0 ? (
				<EmptyState
					icon="checkmark-done-outline"
					title="No tasks yet"
					description="Create one — a final call with the client, a photo of the setup — then add it to a package or straight onto an event."
				/>
			) : (
				templates.map((template) => (
					<Card
						key={template.id}
						style={styles.card}
						onPress={() => open(toDraft(template))}
					>
						<Text variant="bodyStrong">{template.title}</Text>
						<Text
							variant="caption"
							color="textSecondary"
							style={styles.summary}
						>
							{summarize(template)}
						</Text>
					</Card>
				))
			)}
		</Screen>
	);
};

/**
 * A whole number of hours, held as text and committed on blur — same reason as
 * the reminder intervals in company preferences: a per-keystroke commit would
 * publish "2" on the way to typing "24".
 */
const HoursInput = ({
	label,
	seconds,
	onChange,
}: {
	label: string;
	seconds: number;
	onChange: (seconds: number) => void;
}) => {
	const hours = Math.round(seconds / 3600);
	const [text, setText] = useState(String(hours));

	useEffect(() => {
		setText(String(hours));
	}, [hours]);

	return (
		<Input
			label={label}
			value={text}
			onChangeText={setText}
			onBlur={() => {
				const next = Math.max(0, parseInt(text, 10) || 0);
				setText(String(next));
				if (next !== hours) onChange(next * 3600);
			}}
			keyboardType="number-pad"
		/>
	);
};

/**
 * A length of time as "N hours|days". The scheduler runs hourly, so nothing
 * finer is offered. `min` is in the chosen unit: a repeat gap of zero would
 * read as "does not repeat" one control below the switch that says it does.
 */
const SpanInput = ({
	seconds,
	onChange,
	min = 0,
	accessibilityLabel = "How many",
}: {
	seconds: number;
	onChange: (seconds: number) => void;
	min?: number;
	accessibilityLabel?: string;
}) => {
	const styles = useThemedStyles(taskTemplateStyles);
	const parts = offsetToParts(seconds);
	// Held as text and committed on blur, for the reason HoursInput gives.
	const [text, setText] = useState(String(parts.amount));

	useEffect(() => {
		setText(String(parts.amount));
	}, [parts.amount]);

	const typed = () => Math.max(min, parseInt(text, 10) || 0);

	const commit = (unit: OffsetUnit) => {
		const amount = typed();
		setText(String(amount));
		const next = partsToOffset({ amount, unit, direction: "after" });
		if (next !== seconds) onChange(next);
	};

	return (
		<View style={styles.spanRow}>
			<Input
				value={text}
				onChangeText={setText}
				onBlur={() => commit(parts.unit)}
				keyboardType="number-pad"
				accessibilityLabel={accessibilityLabel}
				containerStyle={styles.spanAmount}
			/>
			<SegmentedControl<OffsetUnit>
				fullWidth
				style={styles.flex}
				segments={[
					{ value: "hours", label: "Hours" },
					{ value: "days", label: "Days" },
				]}
				value={parts.unit}
				onChange={commit}
			/>
		</View>
	);
};

const ReminderRuleEditor = ({
	index,
	rule,
	onChange,
	onRemove,
}: {
	index: number;
	rule: TaskReminderRule;
	onChange: (patch: Partial<TaskReminderRule>) => void;
	onRemove: () => void;
}) => {
	const styles = useThemedStyles(taskTemplateStyles);
	const repeats = Boolean(rule.repeat?.enabled);
	const gap = repeatGapSeconds(rule.repeat);

	return (
		<View style={styles.rule}>
			<View style={styles.ruleHead}>
				<Text variant="label" color="textSecondary" uppercase>
					Reminder {index + 1}
				</Text>
				{/* A draft row inside an unsaved form: no confirmation. */}
				<IconButton
					name="close"
					label={`Remove reminder ${index + 1}`}
					size="sm"
					color="textTertiary"
					onPress={onRemove}
				/>
			</View>

			<TaskOffsetEditor
				anchor={rule.anchor}
				offsetSeconds={rule.offsetSeconds}
				onChange={onChange}
			/>

			<View style={styles.repeatRow}>
				<View style={styles.flex}>
					<Text variant="body">Keep reminding until done</Text>
				</View>
				<Toggle
					value={repeats}
					onValueChange={(enabled) =>
						onChange({
							repeat: {
								enabled,
								// A sensible gap rather than zero, which
								// would read as "does not repeat" after all.
								hours: rule.repeat?.hours || (enabled ? 24 : 0),
								minutes: 0,
							},
						})
					}
				/>
			</View>

			{repeats && (
				<HoursInput
					label="Every (hours)"
					seconds={(rule.repeat?.hours ?? 0) * 3600}
					onChange={(seconds) =>
						onChange({
							repeat: {
								enabled: true,
								hours: seconds / 3600,
								minutes: 0,
							},
						})
					}
				/>
			)}

			<Text
				variant="caption"
				color={repeats && !gap ? "warning" : "textSecondary"}
			>
				{repeats && !gap
					? "Set an interval — at zero, it is sent once."
					: `Sent ${describeReminderRule(rule)}.`}
			</Text>
		</View>
	);
};

export default TaskTemplates;

const taskTemplateStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			marginTop: theme.spacing.lg,
		},
		field: {
			marginBottom: theme.spacing.lg,
		},
		hint: {
			marginBottom: theme.spacing.md,
		},
		summary: {
			marginTop: theme.spacing.sm,
		},
		flex: {
			flex: 1,
		},
		/* Content revealed below a row by that row's own switch. */
		revealed: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.md,
			paddingBottom: theme.spacing.md,
			gap: theme.spacing.sm,
		},
		rule: {
			gap: theme.spacing.sm,
			paddingBottom: theme.spacing.lg,
			marginBottom: theme.spacing.lg,
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		ruleHead: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		groupLabel: {
			marginTop: theme.spacing.sm,
		},
		spanRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
		},
		spanAmount: {
			width: 84,
		},
		repeatRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
			marginTop: theme.spacing.xs,
		},
	});
