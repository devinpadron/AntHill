import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import moment from "moment";
import { Badge, Button, Card, Checkbox, Icon, Input, Text, toast } from "../ui";
import { EventTask } from "../../types";
import { ASSIGNEE_MODE_LABEL } from "../../utils/eventTaskUtils";
import { Theme, useThemedStyles } from "../../theme";

/*
 * The tasks on an event, for whoever is looking.
 *
 * ONE card, two readings of it:
 *
 *   a worker   sees each task they are responsible for as a checkbox. Ticking
 *              it is the whole interaction — plus a line of text when the
 *              manager asked for one.
 *   a manager  sees the same list with who has and has not done each one, and
 *              can tick it for someone or hand it back.
 *
 * A worker who is not responsible for a task still sees it, read-only. Hiding
 * it would make "did anyone call the client?" unanswerable from the event,
 * which is the one place a crew looks.
 *
 * Nothing here awaits. Completing and reopening are queued writes that redraw
 * from the local snapshot immediately, so the checkbox moves under the thumb
 * with no signal at all.
 */

type Person = { displayName: string };

type Props = {
	tasks: EventTask[];
	userId: string;
	isManager: boolean;
	membersById: Record<string, Person>;
	complete: (task: EventTask, note?: string, forUserId?: string) => void;
	reopen: (task: EventTask, forUserId?: string) => void;
};

const nameOf = (membersById: Record<string, Person>, id: string) =>
	membersById?.[id]?.displayName ?? "Former member";

const millisOf = (stamp: { toMillis?: () => number } | null | undefined) =>
	stamp?.toMillis?.() ?? null;

export function EventTasksCard({
	tasks,
	userId,
	isManager,
	membersById,
	complete,
	reopen,
}: Props) {
	const styles = useThemedStyles(taskCardStyles);

	/* The task whose note is being written, and the note so far. */
	const [notingId, setNotingId] = useState<string | null>(null);
	const [note, setNote] = useState("");

	if (!tasks.length) return null;

	const open = tasks.filter((task) => task.pendingUserIds?.length > 0);
	const now = Date.now();

	const finish = (task: EventTask, text = "") => {
		complete(task, text);
		setNotingId(null);
		setNote("");
		toast.success("Marked done");
	};

	const tick = (task: EventTask) => {
		if (task.requireNote) {
			setNotingId(task.id);
			setNote("");
			return;
		}
		finish(task);
	};

	return (
		<Card
			title="Tasks"
			titleAccessory={
				open.length > 0 ? (
					<Badge label={`${open.length} open`} tone="warning" />
				) : (
					<Badge label="All done" tone="success" />
				)
			}
			style={styles.card}
		>
			{tasks.map((task, index) => {
				const completions = task.completions ?? {};
				const assignees = task.assigneeUserIds ?? [];
				const settled = !task.pendingUserIds?.length;
				const anyone = task.assigneeMode === "anyone";

				const mine = assignees.includes(userId);
				const iDidIt = Boolean(completions[userId]);
				/*
				 * On an "anyone" task the box reflects the TASK, not my part
				 * of it — once a colleague has made the call there is nothing
				 * left for me to tick.
				 */
				const checked = anyone
					? Object.keys(completions).length > 0
					: iDidIt;
				// I can untick only what I ticked myself.
				const canToggle = mine && (!checked || iDidIt);

				const dueMs = millisOf(task.dueAt);
				const overdue = !settled && dueMs !== null && dueMs < now;
				const noOne = assignees.length === 0;

				return (
					<View
						key={task.id}
						style={[
							styles.task,
							index < tasks.length - 1 && styles.taskDivided,
						]}
					>
						{mine ? (
							<Checkbox
								checked={checked}
								disabled={!canToggle}
								onPress={() =>
									checked ? reopen(task) : tick(task)
								}
								label={task.title}
								description={task.description || undefined}
							/>
						) : (
							<View style={styles.readOnly}>
								<Icon
									name={
										settled
											? "checkmark-circle"
											: "ellipse-outline"
									}
									size="md"
									color={settled ? "success" : "textTertiary"}
								/>
								<View style={styles.flex}>
									<Text variant="bodyStrong">
										{task.title}
									</Text>
									{!!task.description && (
										<Text
											variant="caption"
											color="textSecondary"
										>
											{task.description}
										</Text>
									)}
								</View>
							</View>
						)}

						<View style={styles.meta}>
							{dueMs !== null && (
								<Text
									variant="caption"
									color={overdue ? "danger" : "textSecondary"}
								>
									{overdue ? "Overdue — was due " : "Due "}
									{moment(dueMs).format(
										"ddd, MMM D · h:mm A",
									)}
								</Text>
							)}
							<Text variant="caption" color="textTertiary">
								{ASSIGNEE_MODE_LABEL[task.assigneeMode]}
							</Text>
						</View>

						{/* The note, asked for at the moment it is relevant. */}
						{notingId === task.id && (
							<View style={styles.noteBlock}>
								<Input
									autoFocus
									multiline
									value={note}
									onChangeText={setNote}
									placeholder="Add a note for your manager…"
								/>
								<View style={styles.noteActions}>
									<Button
										title="Cancel"
										variant="text"
										size="small"
										onPress={() => setNotingId(null)}
									/>
									<Button
										title="Mark done"
										icon="checkmark"
										size="small"
										disabled={!note.trim()}
										onPress={() => finish(task, note)}
									/>
								</View>
							</View>
						)}

						{/*
						 * A manager's mistake, said where it can be fixed: a
						 * "specific people" task nobody was picked for reminds
						 * no one and can be ticked by no one.
						 */}
						{noOne && (
							<View style={styles.notice}>
								<Icon
									name="warning"
									size="sm"
									color="warning"
								/>
								<Text
									variant="caption"
									color="warning"
									style={styles.flex}
								>
									{task.assigneeMode === "specific"
										? "Nobody has been picked for this task. Edit the event to choose who does it."
										: "Nobody is on the crew yet, so nobody is being asked."}
								</Text>
							</View>
						)}

						{/* Who did it, and what they said. */}
						{Object.entries(completions).map(([doneId, done]) => (
							<View key={doneId} style={styles.completion}>
								<Icon
									name="checkmark-circle"
									size="sm"
									color="success"
								/>
								<View style={styles.flex}>
									<Text variant="caption">
										{nameOf(membersById, doneId)}
										{done.completedByUserId &&
										done.completedByUserId !== doneId
											? ` · marked by ${nameOf(membersById, done.completedByUserId)}`
											: ""}
										{millisOf(done.completedAt) !== null
											? ` · ${moment(millisOf(done.completedAt)).format("MMM D, h:mm A")}`
											: ""}
									</Text>
									{!!done.note && (
										<Text
											variant="caption"
											color="textSecondary"
										>
											“{done.note}”
										</Text>
									)}
								</View>
								{isManager && (
									<Button
										title="Reopen"
										variant="text"
										size="small"
										onPress={() => reopen(task, doneId)}
									/>
								)}
							</View>
						))}

						{/* Who has not — and the manager's way to settle it. */}
						{isManager &&
							(anyone
								? !settled &&
									!noOne && (
										<View style={styles.completion}>
											<Icon
												name="time-outline"
												size="sm"
												color="textTertiary"
											/>
											<Text
												variant="caption"
												color="textSecondary"
												style={styles.flex}
											>
												Nobody has done this yet
											</Text>
											<Button
												title="Mark done"
												variant="text"
												size="small"
												onPress={() => complete(task)}
											/>
										</View>
									)
								: (task.pendingUserIds ?? []).map(
										(pendingId) => (
											<View
												key={pendingId}
												style={styles.completion}
											>
												<Icon
													name="time-outline"
													size="sm"
													color="textTertiary"
												/>
												<Text
													variant="caption"
													color="textSecondary"
													style={styles.flex}
												>
													{nameOf(
														membersById,
														pendingId,
													)}{" "}
													· not yet
												</Text>
												<Button
													title="Mark done"
													variant="text"
													size="small"
													onPress={() =>
														complete(
															task,
															"",
															pendingId,
														)
													}
												/>
											</View>
										),
									))}
					</View>
				);
			})}
		</Card>
	);
}

const taskCardStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			marginTop: theme.spacing.lg,
		},
		flex: {
			flex: 1,
		},
		task: {
			paddingBottom: theme.spacing.md,
			gap: theme.spacing.xs,
		},
		taskDivided: {
			marginBottom: theme.spacing.md,
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		readOnly: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: theme.spacing.md,
		},
		meta: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "space-between",
			gap: theme.spacing.sm,
		},
		noteBlock: {
			marginTop: theme.spacing.sm,
			gap: theme.spacing.sm,
		},
		noteActions: {
			flexDirection: "row",
			justifyContent: "flex-end",
			gap: theme.spacing.sm,
		},
		notice: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: theme.spacing.sm,
			marginTop: theme.spacing.xs,
		},
		completion: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
			marginTop: theme.spacing.xs,
		},
	});
