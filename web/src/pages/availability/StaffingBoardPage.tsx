import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { EventResponseStatus } from "@app/types";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	Icon,
	LoadingPane,
	MiniBar,
	Select,
	Text,
	useToast,
} from "../../ui";
import { useStaffingBoard, type Cell } from "./useStaffingBoard";
import { CellPopover } from "./CellPopover";
import styles from "./StaffingBoardPage.module.css";

/*
 * The staffing board.
 *
 * Events across the top, workers down the side. This is the page that most
 * justifies a portal: on a phone, "who has not answered for the next month" is
 * a question you answer one event at a time, and by the time you reach the end
 * you have forgotten the start.
 *
 * Seven cell states, chosen so a month reads without clicking anything:
 *
 *   ✓ filled     confirmed
 *   ✕ outlined   declined
 *   ○ hollow     invited, no answer yet
 *   · faint      not invited
 *   🔒 lock       CANNOT SEE IT — restricted worker outside the audience
 *   ▲ corner     assigned to the crew (orthogonal to their answer)
 *   ╱ hatched    double-booked that day
 *
 * The lock is the one that earns its place. "They never replied" and "the job
 * was never visible to them" look identical on a phone, and only one of those
 * is the worker's fault.
 *
 * Keyboard: arrows move, C/P/D set a response, A toggles assignment. Filling a
 * month by mouse alone is the difference between this being useful and being a
 * nicer-looking chore.
 */

const DEFAULT_DAYS = 30;

const todayKey = () => {
	const now = new Date();
	return [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
	].join("-");
};

const addDays = (key: string, days: number) => {
	const [y, m, d] = key.split("-").map(Number);
	const date = new Date(y, m - 1, d + days);
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
};

export function StaffingBoardPage() {
	const toast = useToast();
	const [params, setParams] = useSearchParams();

	const from = params.get("from") ?? todayKey();
	const days = Number(params.get("days") ?? DEFAULT_DAYS);
	const to = addDays(from, days - 1);
	const groupFilter = params.get("group") ?? "all";
	const onlyGaps = params.get("gaps") === "1";
	const density = params.get("density") ?? "comfortable";

	const {
		rows,
		columns,
		events,
		groups,
		isLoading,
		error,
		setResponse,
		toggleAssigned,
	} = useStaffingBoard(from, to);

	const [focus, setFocus] = useState<{ row: number; col: number } | null>(
		null,
	);
	const [popover, setPopover] = useState<{
		row: number;
		col: number;
		anchor: DOMRect;
	} | null>(null);

	function setParam(patch: Record<string, string | null>) {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(patch)) {
			if (value === null) next.delete(key);
			else next.set(key, value);
		}
		setParams(next, { replace: true });
	}

	const visibleRows = useMemo(() => {
		let list = rows;
		if (groupFilter !== "all") {
			list = list.filter((row) =>
				(row.member.groupIds ?? []).includes(groupFilter),
			);
		}
		if (onlyGaps) {
			// Only people with something outstanding — the actual worklist.
			list = list.filter((row) => row.pending > 0);
		}
		return list;
	}, [rows, groupFilter, onlyGaps]);

	/*
	 * Columns are never filtered. "Awaiting reply" narrows the WORKERS — an
	 * event with every reply in still belongs on screen, because the point of
	 * the grid is seeing a person's whole month at once.
	 */
	const visibleColumns = columns;

	/* ---- keyboard grid navigation ---- */
	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (!focus || popover) return;
			const maxRow = visibleRows.length - 1;
			const maxCol = visibleColumns.length - 1;

			const move = (dRow: number, dCol: number) => {
				event.preventDefault();
				setFocus({
					row: Math.max(0, Math.min(maxRow, focus.row + dRow)),
					col: Math.max(0, Math.min(maxCol, focus.col + dCol)),
				});
			};

			switch (event.key) {
				case "ArrowUp":
					return move(-1, 0);
				case "ArrowDown":
					return move(1, 0);
				case "ArrowLeft":
					return move(0, -1);
				case "ArrowRight":
					return move(0, 1);
				case "c":
				case "C":
					return void apply(focus, "confirmed");
				case "p":
				case "P":
					return void apply(focus, "pending");
				case "d":
				case "D":
					return void apply(focus, "declined");
				case "a":
				case "A":
					return void assign(focus);
				case "Escape":
					return setFocus(null);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	async function apply(
		at: { row: number; col: number },
		status: EventResponseStatus,
	) {
		const row = visibleRows[at.row];
		const column = visibleColumns[at.col];
		if (!row || !column) return;
		try {
			await setResponse(column.event, row.member.userId, status);
		} catch (err) {
			toast.error(
				"Could not set that response",
				err instanceof Error ? err.message : undefined,
			);
		}
	}

	async function assign(at: { row: number; col: number }) {
		const row = visibleRows[at.row];
		const column = visibleColumns[at.col];
		if (!row || !column) return;
		try {
			await toggleAssigned(column.event, row.member.userId);
		} catch (err) {
			toast.error(
				"Could not change the assignment",
				err instanceof Error ? err.message : undefined,
			);
		}
	}

	if (error) {
		return (
			<div className={styles.page}>
				<EmptyState
					tone="error"
					title="Could not load the board"
					description={error.message}
				/>
			</div>
		);
	}

	if (isLoading && !events.length)
		return <LoadingPane label="Loading board" />;

	const totals = {
		confirmed: columns.reduce((n, c) => n + c.confirmed, 0),
		pending: columns.reduce((n, c) => n + c.pending, 0),
		declined: columns.reduce((n, c) => n + c.declined, 0),
		understaffed: columns.filter((c) => c.confirmed < c.assigned).length,
	};

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div>
					<Text variant="display" as="h1">
						Availability
					</Text>
					<Text variant="caption" tone="secondary">
						{events.length} events × {visibleRows.length} workers ·{" "}
						{totals.pending} awaiting a reply
						{totals.understaffed > 0 &&
							` · ${totals.understaffed} understaffed`}
					</Text>
				</div>

				<div className={styles.controls}>
					<Select
						value={String(days)}
						onChange={(e) => setParam({ days: e.target.value })}
						aria-label="Window"
					>
						<option value="14">Next 2 weeks</option>
						<option value="30">Next 30 days</option>
						<option value="60">Next 60 days</option>
					</Select>

					{groups.length > 0 && (
						<Select
							value={groupFilter}
							onChange={(e) =>
								setParam({ group: e.target.value })
							}
							aria-label="Group"
						>
							<option value="all">All workers</option>
							{groups.map((group) => (
								<option key={group.id} value={group.id}>
									{group.name}
								</option>
							))}
						</Select>
					)}

					<Button
						variant={onlyGaps ? "primary" : "secondary"}
						size="small"
						icon="funnel-outline"
						onClick={() =>
							setParam({ gaps: onlyGaps ? null : "1" })
						}
					>
						Awaiting reply
					</Button>

					<Button
						variant="ghost"
						size="small"
						icon="resize"
						onClick={() =>
							setParam({
								density:
									density === "compact"
										? "comfortable"
										: "compact",
							})
						}
					>
						{density === "compact" ? "Comfortable" : "Compact"}
					</Button>
				</div>
			</header>

			<Legend />

			{events.length === 0 ? (
				<Card>
					<EmptyState
						icon="calendar-outline"
						title="No events in this window"
						description="Widen the range, or create an event to start staffing it."
					/>
				</Card>
			) : (
				<div className={styles.gridWrap} data-density={density}>
					<table className={styles.grid}>
						<thead>
							<tr>
								<th className={styles.cornerCell}>
									<Text variant="overline" tone="tertiary">
										Worker
									</Text>
								</th>
								{visibleColumns.map((column) => (
									<th
										key={column.event.id}
										className={styles.colHead}
										title={`${column.event.title} — ${column.confirmed}/${column.assigned} confirmed`}
									>
										<div className={styles.colHeadInner}>
											<span className={styles.colDate}>
												{formatDay(
													column.event.dateKey,
												)}
											</span>
											<span className={styles.colTitle}>
												{column.event.title}
											</span>
											<span className={styles.colMix}>
												<MiniBar
													width={44}
													confirmed={column.confirmed}
													pending={column.pending}
													declined={column.declined}
													needed={column.assigned}
												/>
												<span
													className={
														column.confirmed <
														column.assigned
															? styles.short
															: styles.ok
													}
												>
													{column.confirmed}/
													{column.assigned}
												</span>
											</span>
										</div>
									</th>
								))}
							</tr>
						</thead>

						<tbody>
							{visibleRows.map((row, rowIndex) => (
								<tr key={row.member.id}>
									<th className={styles.rowHead}>
										<div className={styles.rowHeadInner}>
											<Text
												variant="body"
												as="span"
												clamp={1}
											>
												{row.member.firstName}{" "}
												{row.member.lastName}
											</Text>
											<span className={styles.rowMeta}>
												{row.member.visibility ===
													"restricted" && (
													<Badge tone="neutral">
														restricted
													</Badge>
												)}
												<span className={styles.tally}>
													<span className={styles.ok}>
														✓{row.confirmed}
													</span>
													<span
														className={styles.wait}
													>
														?{row.pending}
													</span>
													<span className={styles.no}>
														✕{row.declined}
													</span>
												</span>
											</span>
										</div>
									</th>

									{row.cells.map((cell, colIndex) => (
										<td
											key={colIndex}
											className={styles.cellWrap}
										>
											<CellButton
												cell={cell}
												focused={
													focus?.row === rowIndex &&
													focus?.col === colIndex
												}
												onClick={(rect) => {
													setFocus({
														row: rowIndex,
														col: colIndex,
													});
													setPopover({
														row: rowIndex,
														col: colIndex,
														anchor: rect,
													});
												}}
												label={`${row.member.firstName} ${row.member.lastName} — ${visibleColumns[colIndex]?.event.title}`}
											/>
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{popover &&
				visibleRows[popover.row] &&
				visibleColumns[popover.col] && (
					<CellPopover
						anchor={popover.anchor}
						member={visibleRows[popover.row].member}
						event={visibleColumns[popover.col].event}
						cell={visibleRows[popover.row].cells[popover.col]}
						onSet={(status) => {
							void apply(
								{ row: popover.row, col: popover.col },
								status,
							);
							setPopover(null);
						}}
						onToggleAssign={() => {
							void assign({
								row: popover.row,
								col: popover.col,
							});
							setPopover(null);
						}}
						onClose={() => setPopover(null)}
					/>
				)}
		</div>
	);
}

/* --------------------------------------------------------------- cell */

function CellButton({
	cell,
	focused,
	onClick,
	label,
}: {
	cell: Cell;
	focused: boolean;
	onClick: (rect: DOMRect) => void;
	label: string;
}) {
	const glyph =
		cell.state === "confirmed"
			? "✓"
			: cell.state === "declined"
				? "✕"
				: cell.state === "pending"
					? "○"
					: cell.state === "not-visible"
						? ""
						: "";

	return (
		<button
			className={[
				styles.cell,
				styles[cell.state],
				cell.conflict ? styles.conflict : "",
				focused ? styles.focused : "",
			]
				.filter(Boolean)
				.join(" ")}
			onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())}
			aria-label={`${label}: ${cell.state}${cell.assigned ? ", assigned" : ""}${cell.conflict ? ", double-booked" : ""}`}
			title={
				cell.state === "not-visible"
					? "This worker cannot see this event — restricted, and not in its audience"
					: undefined
			}
		>
			{cell.state === "not-visible" ? (
				<Icon name="lock-closed-outline" size={12} />
			) : (
				<span className={styles.glyph}>{glyph}</span>
			)}
			{cell.assigned && <span className={styles.assignedFlag} />}
		</button>
	);
}

function Legend() {
	return (
		<div className={styles.legend}>
			<LegendItem
				className={styles.confirmed}
				glyph="✓"
				label="Confirmed"
			/>
			<LegendItem
				className={styles.pending}
				glyph="○"
				label="No answer"
			/>
			<LegendItem
				className={styles.declined}
				glyph="✕"
				label="Declined"
			/>
			<LegendItem
				className={styles["not-invited"]}
				glyph=""
				label="Not invited"
			/>
			<LegendItem
				className={styles["not-visible"]}
				glyph="🔒"
				label="Cannot see it"
			/>
			<span className={styles.legendItem}>
				<span className={[styles.swatch, styles.conflict].join(" ")} />
				Double-booked
			</span>
			<span className={styles.legendItem}>
				<span className={styles.swatch}>
					<span className={styles.assignedFlag} />
				</span>
				On the crew
			</span>
			<span className={styles.legendKeys}>
				<kbd>←↑↓→</kbd> move · <kbd>C</kbd>/<kbd>P</kbd>/<kbd>D</kbd>{" "}
				set · <kbd>A</kbd> assign
			</span>
		</div>
	);
}

function LegendItem({
	className,
	glyph,
	label,
}: {
	className: string;
	glyph: string;
	label: string;
}) {
	return (
		<span className={styles.legendItem}>
			<span className={[styles.swatch, className].join(" ")}>
				{glyph}
			</span>
			{label}
		</span>
	);
}

function formatDay(dateKey: string): string {
	const date = new Date(`${dateKey}T12:00:00`);
	return date
		.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })
		.toUpperCase();
}
