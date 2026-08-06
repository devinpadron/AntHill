import { useNavigate, useParams } from "react-router-dom";
import {
	formatDuration,
	getStatusBadgeText,
	getStatusTone,
} from "@app/utils/timeUtils";
import type { TimeEntry, TimeEntryConnection } from "@app/types";
import {
	Badge,
	DataTable,
	EmptyState,
	Icon,
	Text,
	type Column,
} from "../../ui";
import { netSecondsOf } from "./usePayroll";
import styles from "./EntryTable.module.css";

/*
 * One employee's entries for the period.
 *
 * `getStatusTone` and `getStatusBadgeText` come from the app's timeUtils, so a
 * status looks and reads identically in both clients — including the mapping
 * that makes `edited` and `pending_approval` both amber.
 *
 * The provenance badge is the column worth having: entries approved before the
 * review block existed carry `inferred_from_status_bug`, which means the
 * recorded approver is a guess. Showing a name without that caveat would be
 * worse than showing nothing.
 */
export function EntryTable({
	entries,
	selected,
	onSelectionChange,
	connectionsByEntry,
}: {
	entries: TimeEntry[];
	selected: Set<string>;
	onSelectionChange: (next: Set<string>) => void;
	/** Fetched once for the period by PayrollPage — see useConnections. */
	connectionsByEntry: Record<string, TimeEntryConnection[]>;
}) {
	const navigate = useNavigate();
	const { companyId } = useParams<{ companyId: string }>();

	const columns: Column<TimeEntry>[] = [
		{
			id: "date",
			header: "Date",
			width: "104px",
			sortValue: (e) => e.dateKey,
			render: (e) => {
				const date = new Date(`${e.dateKey}T12:00:00`);
				return (
					<span className={styles.date}>
						<span className={styles.weekday}>
							{date.toLocaleDateString(undefined, {
								weekday: "short",
							})}
						</span>
						{date.toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}
					</span>
				);
			},
		},
		{
			id: "in",
			header: "In",
			width: "72px",
			align: "right",
			sortValue: (e) => e.clockInAt?.toMillis?.() ?? 0,
			render: (e) => (
				<span className={styles.num}>{clock(e.clockInAt)}</span>
			),
		},
		{
			id: "out",
			header: "Out",
			width: "72px",
			align: "right",
			sortValue: (e) => e.clockOutAt?.toMillis?.() ?? 0,
			render: (e) =>
				e.clockOutAt ? (
					<span className={styles.num}>{clock(e.clockOutAt)}</span>
				) : (
					<Badge tone="accent" dot>
						running
					</Badge>
				),
		},
		{
			id: "net",
			header: "Net",
			width: "76px",
			align: "right",
			sortValue: (e) => netSecondsOf(e),
			render: (e) => (
				<span className={styles.numStrong}>
					{formatDuration(netSecondsOf(e))}
				</span>
			),
			footer: (
				<span className={styles.numStrong}>
					{formatDuration(
						entries.reduce((sum, e) => sum + netSecondsOf(e), 0),
					)}
				</span>
			),
		},
		{
			id: "paused",
			header: "Paused",
			width: "76px",
			align: "right",
			optional: true,
			sortValue: (e) => e.pausedSeconds ?? 0,
			render: (e) =>
				e.pausedSeconds ? (
					<span className={styles.numMuted}>
						{formatDuration(e.pausedSeconds)}
					</span>
				) : (
					<Muted />
				),
		},
		{
			id: "status",
			header: "Status",
			width: "128px",
			sortValue: (e) => e.status,
			render: (e) => (
				<Badge tone={getStatusTone(e.status)} dot>
					{getStatusBadgeText(e.status)}
				</Badge>
			),
		},
		{
			id: "events",
			header: "Events worked",
			sortValue: (e) => e.connectionCount ?? 0,
			render: (e) => {
				const linked = connectionsByEntry[e.id] ?? [];
				if (!e.connectionCount) return <Muted />;
				/*
				 * Names, not a number. "2 events" tells a manager nothing they
				 * can act on; "Wexler Wedding, Corporate lunch" tells them what
				 * the shift actually was. Falls back to the count while the
				 * subcollections are still loading.
				 */
				if (!linked.length) {
					return (
						<Text variant="caption" tone="tertiary" as="span">
							{e.connectionCount} event
							{e.connectionCount === 1 ? "" : "s"}
						</Text>
					);
				}
				const names = linked.map(
					(c) => c.customTitle || c.eventTitleSnapshot || "Untitled",
				);
				return (
					<Text
						variant="caption"
						as="span"
						clamp={1}
						title={names.join("\n")}
					>
						{names.join(", ")}
					</Text>
				);
			},
		},
		{
			id: "edits",
			header: "Edits",
			width: "64px",
			align: "right",
			sortValue: (e) => e.editCount ?? 0,
			render: (e) =>
				e.editCount ? (
					<span
						className={styles.editCount}
						title="Has an edit history"
					>
						{e.editCount}
					</span>
				) : (
					<Muted />
				),
		},
		{
			id: "reviewer",
			header: "Reviewed by",
			sortValue: (e) => e.review?.decidedBy ?? "",
			render: (e) => {
				if (!e.review) return <Muted />;
				const untrusted = e.review.provenance !== "trusted";
				return (
					<span className={styles.reviewer}>
						<Text variant="caption" as="span" clamp={1}>
							{e.review.decidedBy ?? "unknown"}
						</Text>
						{untrusted && (
							<Badge
								tone="warning"
								icon="warning"
								title={
									"This approval predates the review record — " +
									"the approver shown is inferred, not recorded."
								}
							>
								{e.review.provenance ===
								"inferred_from_status_bug"
									? "inferred"
									: "unknown"}
							</Badge>
						)}
					</span>
				);
			},
		},
		{
			id: "notes",
			header: "Notes",
			width: "56px",
			align: "center",
			render: (e) =>
				e.notes?.trim() ? (
					<span className={styles.dim} title={e.notes}>
						<Icon name="document-text-outline" size="xs" />
					</span>
				) : (
					<Muted />
				),
		},
	];

	return (
		<DataTable
			rows={entries}
			columns={columns}
			rowKey={(e) => e.id}
			density="compact"
			storageKey="payroll-entries"
			selection={{ selected, onChange: onSelectionChange }}
			onRowClick={(entry) =>
				navigate(`/${companyId}/payroll/entries/${entry.id}`)
			}
			empty={
				<EmptyState
					icon="time-outline"
					title="No entries"
					description="Nothing recorded for this employee in the period."
				/>
			}
		/>
	);
}

const clock = (stamp?: { toDate?: () => Date } | null) => {
	const date = stamp?.toDate?.();
	return date
		? date.toLocaleTimeString(undefined, {
				hour: "numeric",
				minute: "2-digit",
			})
		: "—";
};

const Muted = () => (
	<Text variant="caption" tone="tertiary" as="span">
		—
	</Text>
);
