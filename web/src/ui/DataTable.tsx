import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { EmptyState } from "./EmptyState";
import { Spinner } from "./Spinner";
import styles from "./DataTable.module.css";

/*
 * The workhorse of the portal.
 *
 * "Info is king" comes down to this component: a sortable, sticky-header table
 * that stays readable at 14 columns. Everything density-related lives here so
 * pages do not each invent their own.
 *
 * Deliberately NOT built on TanStack Table. That library earns its weight when
 * you need grouping, pivoting and column virtualization; what these pages
 * actually need is sorting, a totals row, selection and column visibility, and
 * those are ~150 lines of plain React that stay debuggable. Row VIRTUALIZATION
 * is the one thing worth a dependency, and it is added per-page (the staffing
 * board) rather than baked in here.
 *
 * Density note: rows default to 36px, below the app's 44px hit target. That is
 * intentional and is most of what makes a fourteen-column table legible — a
 * mouse does not need a thumb-sized target. Interactive controls INSIDE a cell
 * still meet 44 where they matter.
 */

export type Column<T> = {
	/** Stable key — also used for sorting state and column visibility. */
	id: string;
	header: ReactNode;
	/** Cell contents. */
	render: (row: T) => ReactNode;
	/**
	 * Value used for sorting. Omit to make the column unsortable — do that for
	 * columns whose cell is a control rather than a fact.
	 */
	sortValue?: (row: T) => string | number | null | undefined;
	width?: string;
	align?: "left" | "right" | "center";
	/** Rendered in the sticky footer, for totals. */
	footer?: ReactNode;
	/** Hidden by default; revealed from the column menu. */
	optional?: boolean;
	/** Tooltip on the header, for a column whose name has to stay short. */
	title?: string;
};

export type DataTableProps<T> = {
	rows: T[];
	columns: Column<T>[];
	rowKey: (row: T) => string;
	isLoading?: boolean;
	/** Shown when there are no rows and nothing is loading. */
	empty?: ReactNode;
	onRowClick?: (row: T) => void;
	/** Highlights the current row — pairs with a detail drawer. */
	selectedKey?: string | null;
	/** Adds a leading checkbox column and a selection model. */
	selection?: {
		selected: Set<string>;
		onChange: (next: Set<string>) => void;
	};
	density?: "compact" | "cozy" | "comfortable";
	/** Persisted column visibility, keyed per page. */
	storageKey?: string;
	className?: string;
};

type SortState = { columnId: string; direction: "asc" | "desc" } | null;

export function DataTable<T>({
	rows,
	columns,
	rowKey,
	isLoading = false,
	empty,
	onRowClick,
	selectedKey,
	selection,
	density = "cozy",
	storageKey,
	className,
}: DataTableProps<T>) {
	const [sort, setSort] = useState<SortState>(null);

	/*
	 * Persisted column visibility.
	 *
	 * Stores which columns were KNOWN as well as which are hidden. Without the
	 * known list, a column added later is absent from the stored hidden set and
	 * therefore appears — so marking a new column `optional` would do nothing
	 * for anyone who had ever touched the menu. That matters here because the
	 * payroll table grows a column per form field, and a ten-field form would
	 * arrive as ten unrequested columns.
	 *
	 * The older format was a bare array of hidden ids; it is still read, and
	 * upgraded on the next toggle.
	 */
	const [hidden, setHidden] = useState<Set<string>>(() => {
		const optional = columns.filter((c) => c.optional).map((c) => c.id);
		const raw = storageKey
			? localStorage.getItem(`cols:${storageKey}`)
			: null;
		if (!raw) return new Set(optional);

		try {
			const parsed = JSON.parse(raw);
			const stored: string[] = Array.isArray(parsed)
				? parsed
				: (parsed.hidden ?? []);
			const known: string[] = Array.isArray(parsed)
				? []
				: (parsed.known ?? []);

			// Anything optional the stored state has never seen stays hidden.
			const unseenOptional = optional.filter((id) => !known.includes(id));
			return new Set([...stored, ...unseenOptional]);
		} catch {
			return new Set(optional);
		}
	});
	const [menuOpen, setMenuOpen] = useState(false);

	const visible = columns.filter((column) => !hidden.has(column.id));

	const toggleColumn = (id: string) => {
		setHidden((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			if (storageKey) {
				localStorage.setItem(
					`cols:${storageKey}`,
					JSON.stringify({
						hidden: [...next],
						known: columns.map((c) => c.id),
					}),
				);
			}
			return next;
		});
	};

	const sorted = useMemo(() => {
		if (!sort) return rows;
		const column = columns.find((c) => c.id === sort.columnId);
		if (!column?.sortValue) return rows;

		const factor = sort.direction === "asc" ? 1 : -1;
		return [...rows].sort((a, b) => {
			const left = column.sortValue!(a);
			const right = column.sortValue!(b);

			// Blanks sort last regardless of direction — an empty cell is not
			// "smallest", it is unknown, and burying it keeps the top of the
			// table meaningful.
			const leftBlank =
				left === null || left === undefined || left === "";
			const rightBlank =
				right === null || right === undefined || right === "";
			if (leftBlank && rightBlank) return 0;
			if (leftBlank) return 1;
			if (rightBlank) return -1;

			if (typeof left === "number" && typeof right === "number") {
				return (left - right) * factor;
			}
			return (
				String(left).localeCompare(String(right), undefined, {
					numeric: true,
					sensitivity: "base",
				}) * factor
			);
		});
	}, [rows, columns, sort]);

	const toggleSort = (column: Column<T>) => {
		if (!column.sortValue) return;
		setSort((current) => {
			if (current?.columnId !== column.id) {
				return { columnId: column.id, direction: "asc" };
			}
			if (current.direction === "asc") {
				return { columnId: column.id, direction: "desc" };
			}
			return null; // third click clears — back to natural order
		});
	};

	const allKeys = sorted.map(rowKey);
	const allSelected =
		Boolean(selection) &&
		allKeys.length > 0 &&
		allKeys.every((key) => selection!.selected.has(key));

	const hasFooter = visible.some((column) => column.footer !== undefined);

	if (!isLoading && rows.length === 0) {
		return (
			<div className={styles.emptyWrap}>
				{empty ?? <EmptyState title="Nothing here yet" />}
			</div>
		);
	}

	return (
		<div
			className={[styles.wrap, className ?? ""].filter(Boolean).join(" ")}
		>
			<div className={styles.scroll} data-density={density}>
				<table className={styles.table}>
					<thead>
						<tr>
							{selection && (
								<th className={styles.checkCell}>
									<input
										type="checkbox"
										checked={allSelected}
										aria-label="Select all rows"
										onChange={() =>
											selection.onChange(
												allSelected
													? new Set()
													: new Set(allKeys),
											)
										}
									/>
								</th>
							)}

							{visible.map((column) => {
								const active = sort?.columnId === column.id;
								return (
									<th
										key={column.id}
										style={{
											width: column.width,
											textAlign: column.align ?? "left",
										}}
										title={column.title}
										aria-sort={
											active
												? sort!.direction === "asc"
													? "ascending"
													: "descending"
												: undefined
										}
									>
										{column.sortValue ? (
											<button
												className={styles.sortButton}
												onClick={() =>
													toggleSort(column)
												}
											>
												{column.header}
												<Icon
													name={
														active
															? sort!
																	.direction ===
																"asc"
																? "arrow-up"
																: "arrow-down"
															: "swap-vertical"
													}
													size={12}
													className={
														active
															? styles.sortActive
															: styles.sortIdle
													}
												/>
											</button>
										) : (
											column.header
										)}
									</th>
								);
							})}

							{/* Column visibility menu, pinned to the right. */}
							<th className={styles.menuCell}>
								<button
									className={styles.menuButton}
									onClick={() => setMenuOpen((v) => !v)}
									aria-label="Choose columns"
									aria-expanded={menuOpen}
								>
									<Icon name="options-outline" size="sm" />
								</button>
								{menuOpen && (
									<>
										<div
											className={styles.backdrop}
											onClick={() => setMenuOpen(false)}
										/>
										<div className={styles.menu}>
											<Text
												variant="overline"
												tone="tertiary"
											>
												Columns
											</Text>
											{columns.map((column) => (
												<label
													key={column.id}
													className={styles.menuItem}
												>
													<input
														type="checkbox"
														checked={
															!hidden.has(
																column.id,
															)
														}
														onChange={() =>
															toggleColumn(
																column.id,
															)
														}
													/>
													<Text
														variant="body"
														as="span"
													>
														{typeof column.header ===
														"string"
															? column.header
															: column.id}
													</Text>
												</label>
											))}
										</div>
									</>
								)}
							</th>
						</tr>
					</thead>

					<tbody>
						{sorted.map((row) => {
							const key = rowKey(row);
							const isSelected = selection?.selected.has(key);
							return (
								<tr
									key={key}
									className={[
										onRowClick ? styles.clickable : "",
										selectedKey === key
											? styles.current
											: "",
										isSelected ? styles.selected : "",
									]
										.filter(Boolean)
										.join(" ")}
									onClick={
										onRowClick
											? () => onRowClick(row)
											: undefined
									}
								>
									{selection && (
										<td
											className={styles.checkCell}
											onClick={(e) => e.stopPropagation()}
										>
											<input
												type="checkbox"
												checked={Boolean(isSelected)}
												aria-label="Select row"
												onChange={() => {
													const next = new Set(
														selection.selected,
													);
													if (next.has(key))
														next.delete(key);
													else next.add(key);
													selection.onChange(next);
												}}
											/>
										</td>
									)}
									{visible.map((column) => (
										<td
											key={column.id}
											style={{
												textAlign:
													column.align ?? "left",
											}}
										>
											{column.render(row)}
										</td>
									))}
									<td />
								</tr>
							);
						})}
					</tbody>

					{hasFooter && (
						<tfoot>
							<tr>
								{selection && (
									<td className={styles.checkCell} />
								)}
								{visible.map((column) => (
									<td
										key={column.id}
										style={{
											textAlign: column.align ?? "left",
										}}
									>
										{column.footer}
									</td>
								))}
								<td />
							</tr>
						</tfoot>
					)}
				</table>

				{isLoading && (
					<div className={styles.loading}>
						<Spinner size={20} color="var(--c-accent)" />
					</div>
				)}
			</div>
		</div>
	);
}

/** Right-aligned numerics that line up column-wise. */
export const numeric: CSSProperties = {
	fontVariantNumeric: "tabular-nums",
};
