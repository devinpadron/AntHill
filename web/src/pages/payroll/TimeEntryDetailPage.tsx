import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
	approveEntries,
	deleteTimeEntry,
	getTimeEntry,
	rejectEntries,
} from "@app/services/timeEntryService";
import { getConnections, getEdits } from "@app/services/timeEntryEditService";
import { useFormSchema } from "@app/hooks/useFormSchema";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { showConfirmation, showPrompt } from "@app/utils/alertUtils";
import {
	formatDuration,
	getStatusBadgeText,
	getStatusTone,
} from "@app/utils/timeUtils";
import type { TimeEntry, TimeEntryConnection, TimeEntryEdit } from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	Icon,
	LoadingPane,
	Text,
	useToast,
} from "../../ui";
import { ExportMenu } from "./ExportMenu";
import { netSecondsOf } from "./usePayroll";
import { FormResponseList } from "./FormResponseList";
import { EditEntrySheet } from "./EditEntrySheet";
import { useEntryEdits } from "./useEntryEdits";
import styles from "./TimeEntryDetailPage.module.css";

/*
 * One time entry, in full.
 *
 * Three columns: the facts, what was submitted, and what happened to it since.
 * The app splits these across a card, a sheet and a modal, so reconciling "the
 * hours changed, who changed them, and what did the worker originally say" means
 * three screens and a memory.
 *
 * The header actions and the edit history both go through the shared services,
 * so an approval here writes exactly what the phone writes.
 */
export function TimeEntryDetailPage() {
	const { companyId, entryId } = useParams<{
		companyId: string;
		entryId: string;
	}>();
	const navigate = useNavigate();
	const toast = useToast();
	const { userId } = useAuth();
	const { byUserId } = useCompanyMembers(companyId!);

	const [entry, setEntry] = useState<TimeEntry | null>(null);
	const [edits, setEdits] = useState<TimeEntryEdit[]>([]);
	const [connections, setConnections] = useState<TimeEntryConnection[]>([]);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState(false);
	const { saveEntryField, saveConnectionField } = useEntryEdits();

	// The schema the entry was submitted against, NOT the company's current
	// one. Schemas are immutable and versioned for exactly this reason: a form
	// published last month must still render the answers given to it.
	const { schema, checklists } = useFormSchema(
		entry?.formSchemaIds?.timeEntry ?? null,
		companyId!,
	);

	/*
	 * Connections answer the EVENT form, which is a different schema from the
	 * timesheet form above. Without it their answers render as raw field ids
	 * (`1749304297989: Good`) instead of the question that was asked.
	 */
	const { schema: eventSchema, checklists: eventChecklists } = useFormSchema(
		entry?.formSchemaIds?.event ?? null,
		companyId!,
	);

	const reload = () => {
		if (!entryId) return;
		void getTimeEntry(entryId).then(setEntry);
	};

	useEffect(() => {
		if (!entryId) return;
		let live = true;
		Promise.all([
			getTimeEntry(entryId),
			getEdits(entryId),
			getConnections(entryId),
		])
			.then(([foundEntry, foundEdits, foundConnections]) => {
				if (!live) return;
				setEntry(foundEntry);
				setEdits(foundEdits);
				setConnections(foundConnections);
			})
			.finally(() => live && setLoading(false));
		return () => {
			live = false;
		};
	}, [entryId]);

	if (loading) return <LoadingPane label="Loading entry" />;

	if (!entry) {
		return (
			<div className={styles.page}>
				<EmptyState
					tone="error"
					title="Time entry not found"
					description="It may have been deleted, or belong to another company."
					action={
						<Button
							variant="secondary"
							onClick={() => navigate(`/${companyId}/payroll`)}
						>
							Back to payroll
						</Button>
					}
				/>
			</div>
		);
	}

	const worker = byUserId?.[entry.userId];
	const workerName = worker
		? `${worker.firstName} ${worker.lastName}`
		: entry.userId;

	async function approve() {
		setBusy(true);
		try {
			await approveEntries([entry!.id], userId);
			toast.success("Approved");
			reload();
		} catch (error) {
			toast.error(
				"Could not approve",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setBusy(false);
		}
	}

	function reject() {
		/*
		 * showPrompt is the app's own helper. It raises a react-native Alert,
		 * which AlertHost renders as a real dialog — so the rejection reason is
		 * collected in the design system rather than a browser prompt, and the
		 * "reason is required" rule lives in one place.
		 */
		showPrompt(
			"Reject this entry",
			`${workerName} will see this reason. Be specific enough to act on.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Reject",
					style: "destructive",
					onPress: (reason) => {
						if (!reason?.trim()) {
							toast.warning("A reason is required to reject");
							return;
						}
						void (async () => {
							setBusy(true);
							try {
								await rejectEntries(
									[entry!.id],
									userId,
									reason.trim(),
								);
								toast.success("Rejected");
								reload();
							} catch (error) {
								toast.error(
									"Could not reject",
									error instanceof Error
										? error.message
										: undefined,
								);
							} finally {
								setBusy(false);
							}
						})();
					},
				},
			],
		);
	}

	function remove() {
		showConfirmation(
			"Delete this time entry?",
			"Its connections, edit history and attachments go with it. This cannot be undone.",
			() => {
				void (async () => {
					try {
						await deleteTimeEntry(companyId!, entry!.id);
						toast.success("Entry deleted");
						navigate(`/${companyId}/payroll`);
					} catch (error) {
						toast.error(
							"Could not delete",
							error instanceof Error ? error.message : undefined,
						);
					}
				})();
			},
			"Delete",
			"destructive",
		);
	}

	const pending =
		entry.status === "pending_approval" || entry.status === "completed";

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div className={styles.headerMain}>
					<button
						className={styles.back}
						onClick={() => navigate(`/${companyId}/payroll`)}
					>
						<Icon name="chevron-back" size="sm" />
						Payroll
					</button>
					<div className={styles.title}>
						<Text variant="display" as="h1">
							{workerName}
						</Text>
						<Badge tone={getStatusTone(entry.status)} dot>
							{getStatusBadgeText(entry.status)}
						</Badge>
					</div>
					<Text variant="body" tone="secondary">
						{new Date(
							`${entry.dateKey}T12:00:00`,
						).toLocaleDateString(undefined, {
							weekday: "long",
							month: "long",
							day: "numeric",
							year: "numeric",
						})}
					</Text>
				</div>

				<div className={styles.actions}>
					<ExportMenu
						entries={[entry]}
						employee={worker ?? null}
						label={entry.dateKey}
					/>
					<Button
						variant="secondary"
						icon="pencil"
						onClick={() => setEditing(true)}
					>
						Edit
					</Button>
					{pending && (
						<>
							<Button
								variant="destructive"
								onClick={reject}
								busy={busy}
							>
								Reject
							</Button>
							<Button
								variant="primary"
								onClick={approve}
								busy={busy}
							>
								Approve
							</Button>
						</>
					)}
					<Button
						variant="ghost"
						icon="trash-outline"
						onClick={remove}
					>
						Delete
					</Button>
				</div>
			</header>

			<div className={styles.columns}>
				{/* ------------------------------------------- facts */}
				<div className={styles.left}>
					<Card title="Shift">
						<Timeline entry={entry} />
						<dl className={styles.facts}>
							<Fact
								label="Clocked in"
								value={time(entry.clockInAt)}
							/>
							<Fact
								label="Clocked out"
								value={
									entry.clockOutAt
										? time(entry.clockOutAt)
										: "still running"
								}
							/>
							<Fact
								label="Worked"
								value={formatDuration(entry.workedSeconds ?? 0)}
							/>
							<Fact
								label="Paused"
								value={formatDuration(entry.pausedSeconds ?? 0)}
							/>
							<Fact
								label="Net"
								value={formatDuration(netSecondsOf(entry))}
								strong
							/>
							<Fact label="Day" value={entry.dateKey} mono />
						</dl>
					</Card>

					{entry.submission && (
						<Card title="Submitted">
							<dl className={styles.facts}>
								<Fact
									label="At"
									value={time(entry.submission.submittedAt)}
								/>
							</dl>
							{entry.submission.notes && (
								<div className={styles.quote}>
									<Text variant="body">
										{entry.submission.notes}
									</Text>
								</div>
							)}
						</Card>
					)}

					{entry.review && (
						<Card title="Review">
							<dl className={styles.facts}>
								<Fact
									label="Decision"
									value={entry.review.decision}
								/>
								<Fact
									label="By"
									value={
										entry.review.decidedBy
											? byUserId?.[entry.review.decidedBy]
												? `${byUserId[entry.review.decidedBy].firstName} ${byUserId[entry.review.decidedBy].lastName}`
												: entry.review.decidedBy
											: "—"
									}
								/>
								<Fact
									label="At"
									value={time(entry.review.decidedAt)}
								/>
							</dl>

							{/*
							 * Provenance. An approval recorded before the review
							 * block existed has an INFERRED approver — saying so
							 * is better than presenting a guess as a fact.
							 */}
							{entry.review.provenance !== "trusted" && (
								<div className={styles.warnBox}>
									<Icon name="warning" size="sm" />
									<Text variant="caption" as="span">
										This decision predates the review
										record. The approver shown is inferred
										from the entry's status, not something
										anyone wrote down.
									</Text>
								</div>
							)}

							{entry.review.reason && (
								<div className={styles.quote}>
									<Text variant="body">
										{entry.review.reason}
									</Text>
								</div>
							)}
						</Card>
					)}

					{entry.notes?.trim() && (
						<Card title="Worker notes">
							<Text variant="body">{entry.notes}</Text>
						</Card>
					)}
				</div>

				{/* ------------------------------- what was submitted */}
				<div className={styles.center}>
					{connections.length > 0 && (
						<Card title={`Events worked (${connections.length})`}>
							<div className={styles.connections}>
								{connections.map((connection) => (
									<div
										key={connection.id}
										className={styles.connection}
									>
										<div className={styles.connectionHead}>
											<Icon
												name="calendar-outline"
												size="sm"
												className={styles.dim}
											/>
											<Text variant="bodyStrong">
												{connection.customTitle ||
													connection.eventTitleSnapshot ||
													"Untitled"}
											</Text>
										</div>
										{Object.keys(
											connection.formResponses ?? {},
										).length > 0 && (
											<FormResponseList
												schema={eventSchema}
												responses={
													connection.formResponses
												}
												checklists={eventChecklists}
												compact
												onSave={(
													field,
													next,
													previous,
												) =>
													saveConnectionField(
														entry,
														connection,
														field,
														next,
														previous,
													).then(reload)
												}
											/>
										)}
									</div>
								))}
							</div>
						</Card>
					)}
					<Card
						title="Form responses"
						actions={
							schema && (
								<Badge tone="neutral" title={schema.id}>
									v{schema.version}
								</Badge>
							)
						}
					>
						{/*
						 * A hash mismatch means the schema this entry names has
						 * changed underneath it — which should be impossible,
						 * since schemas are append-only. Worth shouting about.
						 */}
						{schema &&
							entry.formSchemaHashes?.timeEntry &&
							schema.contentHash !==
								entry.formSchemaHashes.timeEntry && (
								<div className={styles.warnBox}>
									<Icon name="warning" size="sm" />
									<Text variant="caption" as="span">
										This entry was submitted against a
										different version of the form than the
										one loaded. The answers below may not
										line up with their labels.
									</Text>
								</div>
							)}

						<FormResponseList
							schema={schema}
							responses={entry.formResponses}
							checklists={checklists}
							onSave={(field, next, previous) =>
								saveEntryField(
									entry,
									field,
									next,
									previous,
								).then(reload)
							}
						/>
					</Card>
				</div>

				{/* ------------------------------ what happened since */}
				<div className={styles.right}>
					<Card title={`Edit history (${edits.length})`}>
						{edits.length === 0 ? (
							<Text variant="caption" tone="tertiary">
								Never edited since it was submitted.
							</Text>
						) : (
							<ol className={styles.timeline}>
								{edits.map((edit) => (
									<li
										key={edit.id}
										className={styles.editItem}
									>
										<div className={styles.editHead}>
											<Text
												variant="bodyStrong"
												as="span"
											>
												{edit.actorDisplayName ??
													"Unknown"}
											</Text>
											<Badge
												tone={
													edit.source ===
													"legacy_unknown"
														? "warning"
														: "neutral"
												}
											>
												{edit.source ===
												"legacy_unknown"
													? "pre-history"
													: edit.source ===
														  "editSheet"
														? "edit sheet"
														: "inline"}
											</Badge>
										</div>
										<Text variant="caption" tone="tertiary">
											{time(edit.at)}
										</Text>
										<Text variant="body">
											{edit.summary}
										</Text>

										{/* Before → after, for the four tracked fields. */}
										{edit.before && (
											<div className={styles.diff}>
												<Diff
													label="In"
													before={time(
														edit.before.clockInAt,
													)}
													after={time(
														entry.clockInAt,
													)}
												/>
												<Diff
													label="Out"
													before={time(
														edit.before.clockOutAt,
													)}
													after={time(
														entry.clockOutAt,
													)}
												/>
												<Diff
													label="Worked"
													before={
														edit.before
															.workedSeconds !==
														null
															? formatDuration(
																	edit.before
																		.workedSeconds,
																)
															: "—"
													}
													after={formatDuration(
														entry.workedSeconds ??
															0,
													)}
												/>
											</div>
										)}
									</li>
								))}
							</ol>
						)}
					</Card>
				</div>
			</div>

			{editing && (
				<EditEntrySheet
					entry={entry}
					schema={schema}
					checklists={checklists}
					onClose={() => setEditing(false)}
					onSaved={reload}
				/>
			)}
		</div>
	);
}

/* ------------------------------------------------------------- timeline bar */

/**
 * The shift as a bar: worked in accent, pauses cut out in warning.
 *
 * Two numbers ("8h worked, 45m paused") do not tell you WHEN the gap was, and
 * a gap at 3pm reads very differently from one at the end of a shift.
 */
function Timeline({ entry }: { entry: TimeEntry }) {
	const start = entry.clockInAt?.toDate?.();
	const end = entry.clockOutAt?.toDate?.() ?? new Date();
	if (!start) return null;

	const totalMs = Math.max(1, end.getTime() - start.getTime());
	const pausedMs = (entry.pausedSeconds ?? 0) * 1000;
	const pausedPct = Math.min(100, (pausedMs / totalMs) * 100);

	return (
		<div className={styles.timelineWrap}>
			<div className={styles.bar}>
				<div
					className={styles.worked}
					style={{ width: `${100 - pausedPct}%` }}
				/>
				{pausedPct > 0 && (
					<div
						className={styles.paused}
						style={{ width: `${pausedPct}%` }}
						title={`${formatDuration(entry.pausedSeconds ?? 0)} paused`}
					/>
				)}
			</div>
			<div className={styles.barLabels}>
				<Text variant="caption" tone="tertiary" as="span">
					{start.toLocaleTimeString(undefined, {
						hour: "numeric",
						minute: "2-digit",
					})}
				</Text>
				<Text variant="caption" tone="tertiary" as="span">
					{entry.clockOutAt
						? end.toLocaleTimeString(undefined, {
								hour: "numeric",
								minute: "2-digit",
							})
						: "now"}
				</Text>
			</div>
		</div>
	);
}

function Diff({
	label,
	before,
	after,
}: {
	label: string;
	before: string;
	after: string;
}) {
	if (before === after || before === "—") return null;
	return (
		<div className={styles.diffRow}>
			<Text variant="caption" tone="tertiary" as="span">
				{label}
			</Text>
			<span className={styles.diffBefore}>{before}</span>
			<Icon name="arrow-forward" size="xs" className={styles.dim} />
			<span className={styles.diffAfter}>{after}</span>
		</div>
	);
}

function Fact({
	label,
	value,
	mono,
	strong,
}: {
	label: string;
	value: string;
	mono?: boolean;
	strong?: boolean;
}) {
	return (
		<div className={styles.fact}>
			<Text variant="caption" tone="tertiary" as="dt">
				{label}
			</Text>
			<Text variant={strong ? "bodyStrong" : "body"} as="dd" mono={mono}>
				{value}
			</Text>
		</div>
	);
}

const time = (stamp?: { toDate?: () => Date } | null): string => {
	const date = stamp?.toDate?.();
	if (!date) return "—";
	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
};
