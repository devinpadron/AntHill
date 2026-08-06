import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { approveEntries, rejectEntries } from "@app/services/timeEntryService";
import { formatDuration, getStatusTone } from "@app/utils/timeUtils";
import { showPrompt } from "@app/utils/alertUtils";
import type { TimeEntry } from "@app/types";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	Badge,
	Button,
	Card,
	DataTable,
	EmptyState,
	Icon,
	Text,
	useToast,
	type Column,
} from "../../ui";
import {
	addDays,
	startOfWeek,
	toDateKey,
	usePayroll,
	type EmployeeTotals,
} from "./usePayroll";
import { Sparkline } from "./Sparkline";
import { EntryTable } from "./EntryTable";
import { AttentionRail } from "./AttentionRail";
import { WeekView } from "./WeekView";
import { useConnections } from "./useConnections";
import { ExportMenu } from "./ExportMenu";
import styles from "./PayrollPage.module.css";

/*
 * Payroll.
 *
 * The surface with the most to gain from a desktop. The app shows one week, one
 * employee at a time, expanded from a list. Here the whole period is a table:
 * every employee, every total, sortable, with the entries for whoever is
 * selected beside it.
 *
 * `formatDuration` and `getStatusTone` are imported from the app's timeUtils —
 * pure functions with no imports of their own — so an hour reads the same and a
 * status badge is the same colour in both clients.
 *
 * Approvals go through `approveEntries` / `rejectEntries`, which write the
 * review block with provenance "trusted". Nothing here reimplements that.
 */

const STATUS_FILTERS = [
	{ value: "all", label: "All" },
	{ value: "pending_approval", label: "Pending" },
	{ value: "approved", label: "Approved" },
	{ value: "rejected", label: "Rejected" },
	{ value: "completed", label: "Completed" },
	{ value: "active", label: "Running" },
] as const;

export function PayrollPage() {
	const { preferences } = useCompany();
	const { userId } = useAuth();
	const toast = useToast();
	const [params, setParams] = useSearchParams();

	const startsMonday = preferences.workWeekStarts === "monday";

	const from = useMemo(() => {
		const raw = params.get("from");
		if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
			const [y, m, d] = raw.split("-").map(Number);
			return new Date(y, m - 1, d);
		}
		return startOfWeek(new Date(), startsMonday);
	}, [params, startsMonday]);

	const spanDays = Number(params.get("days") ?? 7);
	const to = addDays(from, spanDays - 1);

	const statusFilter = params.get("status") ?? "all";
	const selectedUserId = params.get("user");
	const expanded = params.get("view") === "week";

	const { byEmployee, statusCounts, attention, totals, dayKeys, isLoading } =
		usePayroll(from, to);

	const [selectedEntries, setSelectedEntries] = useState<Set<string>>(
		new Set(),
	);
	const [busy, setBusy] = useState(false);

	function setParam(patch: Record<string, string | null>) {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(patch)) {
			if (value === null) next.delete(key);
			else next.set(key, value);
		}
		setParams(next, { replace: true });
	}

	function shiftPeriod(direction: number) {
		setParam({ from: toDateKey(addDays(from, spanDays * direction)) });
		setSelectedEntries(new Set());
	}

	const visibleEmployees = useMemo(() => {
		if (statusFilter === "all") return byEmployee;
		return byEmployee
			.map((employee) => ({
				...employee,
				entries: employee.entries.filter(
					(entry) => entry.status === statusFilter,
				),
			}))
			.filter((employee) => employee.entries.length > 0);
	}, [byEmployee, statusFilter]);

	const selected =
		visibleEmployees.find((e) => e.member.userId === selectedUserId) ??
		null;

	/*
	 * Connected events for whichever employee is open. Fetched once here so the
	 * entries table (names) and the week view (names + answers) share one read
	 * per shift rather than one each.
	 */
	const { byEntryId: connectionsByEntry, refresh: refreshConnections } =
		useConnections(selected?.entries ?? []);

	const selectedRows: TimeEntry[] = useMemo(
		() =>
			visibleEmployees
				.flatMap((employee) => employee.entries)
				.filter((entry) => selectedEntries.has(entry.id)),
		[visibleEmployees, selectedEntries],
	);

	const selectedSeconds = selectedRows.reduce(
		(sum, entry) =>
			sum +
			Math.max(
				0,
				(entry.workedSeconds ?? 0) - (entry.pausedSeconds ?? 0),
			),
		0,
	);

	async function decide(kind: "approve" | "reject") {
		if (!selectedRows.length) return;
		const ids = selectedRows.map((entry) => entry.id);

		if (kind === "reject") {
			/*
			 * A rejection without a reason is a message a worker cannot act on,
			 * so the service requires one and so does this.
			 *
			 * showPrompt is the app's own helper — it raises a react-native
			 * Alert, which AlertHost renders as a proper dialog. Using the
			 * browser's window.prompt here would be the one place the portal
			 * stepped outside its own design system.
			 */
			showPrompt(
				`Reject ${ids.length} ${ids.length === 1 ? "entry" : "entries"}`,
				"Everyone affected sees this reason. Be specific enough to act on.",
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
										ids,
										userId,
										reason.trim(),
									);
									toast.success(
										`${ids.length} entries rejected`,
									);
									setSelectedEntries(new Set());
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
			return;
		}

		setBusy(true);
		try {
			await approveEntries(ids, userId);
			toast.success(`${ids.length} entries approved`);
			setSelectedEntries(new Set());
		} catch (error) {
			toast.error(
				"Could not approve",
				error instanceof Error ? error.message : undefined,
			);
		} finally {
			setBusy(false);
		}
	}

	const columns: Column<EmployeeTotals>[] = [
		{
			id: "employee",
			header: "Employee",
			width: "200px",
			sortValue: (e) => `${e.member.lastName} ${e.member.firstName}`,
			render: (e) => (
				<Text variant="bodyStrong" as="span" clamp={1}>
					{e.member.lastName}, {e.member.firstName}
				</Text>
			),
		},
		{
			id: "entries",
			header: "Entries",
			width: "70px",
			align: "right",
			sortValue: (e) => e.entries.length,
			render: (e) => (
				<span className={styles.num}>{e.entries.length}</span>
			),
			footer: <span className={styles.num}>{totals.entries}</span>,
		},
		{
			id: "days",
			header: "Days",
			width: "62px",
			align: "right",
			sortValue: (e) => e.days,
			render: (e) => <span className={styles.num}>{e.days}</span>,
		},
		{
			id: "worked",
			header: "Worked",
			width: "84px",
			align: "right",
			sortValue: (e) => e.workedSeconds,
			render: (e) => (
				<span className={styles.num}>
					{formatDuration(e.workedSeconds)}
				</span>
			),
			footer: (
				<span className={styles.num}>
					{formatDuration(totals.workedSeconds)}
				</span>
			),
		},
		{
			id: "paused",
			header: "Paused",
			width: "84px",
			align: "right",
			sortValue: (e) => e.pausedSeconds,
			render: (e) =>
				e.pausedSeconds ? (
					<span className={styles.numMuted}>
						{formatDuration(e.pausedSeconds)}
					</span>
				) : (
					<Muted />
				),
			footer: (
				<span className={styles.numMuted}>
					{formatDuration(totals.pausedSeconds)}
				</span>
			),
		},
		{
			id: "net",
			header: "Net",
			width: "84px",
			align: "right",
			sortValue: (e) => e.netSeconds,
			render: (e) => (
				<span className={styles.numStrong}>
					{formatDuration(e.netSeconds)}
				</span>
			),
			footer: (
				<span className={styles.numStrong}>
					{formatDuration(totals.netSeconds)}
				</span>
			),
		},
		{
			id: "longest",
			header: "Longest",
			width: "84px",
			align: "right",
			optional: true,
			sortValue: (e) => e.longestSeconds,
			render: (e) => (
				<span className={styles.numMuted}>
					{formatDuration(e.longestSeconds)}
				</span>
			),
		},
		{
			id: "week",
			header: "Shape",
			width: "110px",
			title: "Hours per day across the period",
			render: (e) => <Sparkline values={e.perDay} labels={dayKeys} />,
		},
		{
			id: "status",
			header: "Review",
			width: "150px",
			sortValue: (e) => e.pending,
			render: (e) => (
				<span className={styles.reviewCell}>
					{e.pending > 0 && (
						<Badge tone="warning">{e.pending} pending</Badge>
					)}
					{e.approved > 0 && (
						<Badge tone="success">{e.approved}</Badge>
					)}
					{e.rejected > 0 && (
						<Badge tone="danger">{e.rejected}</Badge>
					)}
					{!e.pending && !e.approved && !e.rejected && <Muted />}
				</span>
			),
		},
		{
			id: "lastOut",
			header: "Last out",
			width: "110px",
			optional: true,
			sortValue: (e) => e.lastOut?.getTime() ?? 0,
			render: (e) =>
				e.lastOut ? (
					<Text variant="caption" tone="secondary" as="span">
						{e.lastOut.toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}
					</Text>
				) : (
					<Muted />
				),
		},
	];

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div className={styles.periodNav}>
					<button
						className={styles.navButton}
						onClick={() => shiftPeriod(-1)}
						aria-label="Previous period"
					>
						<Icon name="chevron-back" size="sm" />
					</button>
					<div className={styles.period}>
						<Text variant="title" as="h1">
							{formatRange(from, to)}
						</Text>
						<Text variant="caption" tone="tertiary">
							Week starts {preferences.workWeekStarts}
						</Text>
					</div>
					<button
						className={styles.navButton}
						onClick={() => shiftPeriod(1)}
						aria-label="Next period"
					>
						<Icon name="chevron-forward" size="sm" />
					</button>
					<Button
						variant="ghost"
						size="small"
						onClick={() =>
							setParam({
								from: toDateKey(
									startOfWeek(new Date(), startsMonday),
								),
								days: "7",
							})
						}
					>
						This week
					</Button>
					<Button
						variant="ghost"
						size="small"
						onClick={() =>
							setParam({
								from: toDateKey(
									startOfWeek(new Date(), startsMonday),
								),
								days: "14",
							})
						}
					>
						Two weeks
					</Button>
				</div>

				<ExportMenu
					entries={
						selectedRows.length
							? selectedRows
							: (selected?.entries ??
								visibleEmployees.flatMap((e) => e.entries))
					}
					employee={selected?.member ?? null}
					label={formatRange(from, to)}
				/>
			</header>

			<div className={styles.stats}>
				<Stat
					label="Net hours"
					value={formatDuration(totals.netSeconds)}
				/>
				<Stat
					label="Worked"
					value={formatDuration(totals.workedSeconds)}
				/>
				<Stat
					label="Paused"
					value={formatDuration(totals.pausedSeconds)}
				/>
				<Stat label="Entries" value={String(totals.entries)} />
				<Stat label="Employees" value={String(totals.employees)} />
				<Stat
					label="Pending"
					value={String(totals.pending)}
					tone={totals.pending ? "warning" : undefined}
				/>
			</div>

			<div className={styles.chips}>
				{STATUS_FILTERS.map((filter) => {
					const count =
						statusCounts[
							filter.value as keyof typeof statusCounts
						] ?? 0;
					if (filter.value !== "all" && count === 0) return null;
					return (
						<button
							key={filter.value}
							className={[
								styles.chip,
								statusFilter === filter.value
									? styles.chipActive
									: "",
							]
								.filter(Boolean)
								.join(" ")}
							onClick={() => setParam({ status: filter.value })}
						>
							{filter.label}
							<span className={styles.chipCount}>{count}</span>
						</button>
					);
				})}
			</div>

			<div className={styles.body}>
				<Card flush className={styles.masterCard}>
					<DataTable
						rows={visibleEmployees}
						columns={columns}
						rowKey={(e) => e.member.userId}
						isLoading={isLoading}
						storageKey="payroll-employees"
						onRowClick={(employee) =>
							setParam({ user: employee.member.userId })
						}
						selectedKey={selectedUserId}
						empty={
							<EmptyState
								icon="time-outline"
								title="No time entries in this period"
								description="Move to another week, or clear the status filter."
							/>
						}
					/>
				</Card>

				{selected ? (
					<Card
						flush
						className={styles.detailCard}
						title={`${selected.member.firstName} ${selected.member.lastName} — ${formatDuration(
							selected.netSeconds,
						)} net`}
						actions={
							<span className={styles.detailActions}>
								{/*
								 * Two ways to read one employee's period. The
								 * table is for scanning hours; the week is for
								 * approving, with every answer and note already
								 * on screen instead of behind six clicks.
								 */}
								<button
									className={[
										styles.modeButton,
										!expanded ? styles.modeActive : "",
									]
										.filter(Boolean)
										.join(" ")}
									onClick={() => setParam({ view: null })}
								>
									<Icon name="list" size="sm" />
									Entries
								</button>
								<button
									className={[
										styles.modeButton,
										expanded ? styles.modeActive : "",
									]
										.filter(Boolean)
										.join(" ")}
									onClick={() => setParam({ view: "week" })}
								>
									<Icon name="calendar-outline" size="sm" />
									Whole week
								</button>
								<button
									className={styles.closeDetail}
									onClick={() => setParam({ user: null })}
									aria-label="Close"
								>
									<Icon name="close" size="sm" />
								</button>
							</span>
						}
					>
						{expanded ? (
							<div className={styles.weekScroll}>
								<WeekView
									employee={selected}
									dayKeys={dayKeys}
									connectionsByEntry={connectionsByEntry}
									onConnectionsChanged={refreshConnections}
								/>
							</div>
						) : (
							<EntryTable
								entries={selected.entries}
								selected={selectedEntries}
								onSelectionChange={setSelectedEntries}
								connectionsByEntry={connectionsByEntry}
							/>
						)}
					</Card>
				) : (
					<AttentionRail attention={attention} />
				)}
			</div>

			{/* Sticky bulk bar — appears only with a selection, as the app's does. */}
			{selectedRows.length > 0 && (
				<div className={styles.bulkBar}>
					<Text variant="bodyStrong" tone="inverse" as="span">
						{selectedRows.length} selected ·{" "}
						{formatDuration(selectedSeconds)}
					</Text>
					<div className={styles.bulkActions}>
						<Button
							variant="ghost"
							size="small"
							onClick={() => setSelectedEntries(new Set())}
						>
							Clear
						</Button>
						<Button
							variant="destructive"
							size="small"
							busy={busy}
							onClick={() => decide("reject")}
						>
							Reject
						</Button>
						<Button
							variant="primary"
							size="small"
							busy={busy}
							onClick={() => decide("approve")}
						>
							Approve
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: "warning";
}) {
	return (
		<div className={styles.stat}>
			<Text
				variant="title"
				as="span"
				tone={tone === "warning" ? "warning" : "default"}
			>
				{value}
			</Text>
			<Text variant="caption" tone="tertiary" as="span">
				{label}
			</Text>
		</div>
	);
}

const Muted = () => (
	<Text variant="caption" tone="tertiary" as="span">
		—
	</Text>
);

function formatRange(from: Date, to: Date): string {
	const sameMonth = from.getMonth() === to.getMonth();
	const left = from.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
	const right = to.toLocaleDateString(undefined, {
		month: sameMonth ? undefined : "short",
		day: "numeric",
		year: "numeric",
	});
	return `${left} – ${right}`;
}

export { getStatusTone };
