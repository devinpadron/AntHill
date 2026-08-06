import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useCalendarEvents } from "@app/hooks/useCalendarEvents";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { subscribeEventLabels } from "@app/services/libraryService";
import type { Event, EventLabel } from "@app/types";
import { FilterType } from "@app/types/enums/FilterType";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import { Button, Card, EmptyState, Icon, Text } from "../../ui";
import {
	DEFAULT_FILTERS,
	FilterRail,
	isFiltered,
	type CalendarFilters,
} from "./FilterRail";
import { MonthGrid } from "./MonthGrid";
import { EventList } from "./EventList";
import styles from "./CalendarPage.module.css";

/*
 * The calendar.
 *
 * `useCalendarEvents` is imported VERBATIM from the app. It owns the date
 * windowing and the `refineSelection` wiring that decide which events a filter
 * actually returns — re-deriving that here would be the easiest place for the
 * two clients to disagree about what "my events" means. Its only web-hostile
 * dependency was a type import from react-native-calendars, which the shim
 * satisfies.
 *
 * Two views, both denser than the phone's:
 *
 *   Month  a real 7-column grid at viewport height. Every event chip carries
 *          its time, title, staffed count and response mix on one line, so a
 *          month reads without a single tap.
 *   List   a sortable table with fourteen columns. This is the one that makes
 *          "which of the next 40 events is short-staffed" a five-second
 *          question instead of forty taps.
 *
 * View, month and every filter live in the URL, so a particular slice of the
 * calendar can be bookmarked or sent to someone.
 */

type ViewMode = "month" | "list";

export function CalendarPage() {
	const { companyId, preferences } = useCompany();
	const { userId } = useAuth();
	const { members } = useCompanyMembers(companyId);

	const navigate = useNavigate();
	const [params, setParams] = useSearchParams();
	const view = (params.get("view") as ViewMode) ?? "month";

	const focusedMonth = useMemo(() => {
		const raw = params.get("month");
		if (raw && /^\d{4}-\d{2}$/.test(raw)) {
			const [year, month] = raw.split("-").map(Number);
			return new Date(year, month - 1, 1);
		}
		return new Date();
	}, [params]);

	const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);
	const [labels, setLabels] = useState<EventLabel[]>([]);

	useEffect(() => subscribeEventLabels(companyId, setLabels), [companyId]);

	const { events, isLoading, error, loadPastEvents, hasLoadedPast } =
		useCalendarEvents({
			companyId,
			userId,
			filterType: filters.filterType,
			selectedUsers: filters.selectedUsers,
			showAllSelectedOnly: filters.allSelected,
			showExactSelectedOnly: filters.exactSelected,
			focusedMonth,
		});

	const labelsById = useMemo(
		() => new Map(labels.map((label) => [label.id, label])),
		[labels],
	);

	/*
	 * Label and attention filters are applied here rather than in the hook:
	 * they are portal-only affordances, and pushing them into the shared hook
	 * would change what the app fetches.
	 */
	const visible = useMemo(
		() =>
			events.filter((event) => {
				if (
					filters.labelIds.length &&
					!filters.labelIds.includes(event.labelId ?? "")
				) {
					return false;
				}
				if (filters.unstaffedOnly && event.assignedCount > 0) {
					return false;
				}
				if (
					filters.pendingOnly &&
					(event.responseCounts?.pending ?? 0) === 0
				) {
					return false;
				}
				return true;
			}),
		[events, filters],
	);

	const stats = useMemo(() => {
		const assignments = visible.reduce(
			(sum, event) => sum + (event.assignedCount ?? 0),
			0,
		);
		const confirmed = visible.reduce(
			(sum, event) => sum + (event.responseCounts?.confirmed ?? 0),
			0,
		);
		const invited = visible.reduce(
			(sum, event) =>
				sum +
				(event.responseCounts?.confirmed ?? 0) +
				(event.responseCounts?.pending ?? 0) +
				(event.responseCounts?.declined ?? 0),
			0,
		);
		return {
			events: visible.length,
			assignments,
			unstaffed: visible.filter((e) => !e.assignedCount).length,
			confirmRate: invited
				? Math.round((confirmed / invited) * 100)
				: null,
		};
	}, [visible]);

	function setParam(key: string, value: string) {
		const next = new URLSearchParams(params);
		next.set(key, value);
		setParams(next, { replace: true });
	}

	function shiftMonth(delta: number) {
		const next = new Date(
			focusedMonth.getFullYear(),
			focusedMonth.getMonth() + delta,
			1,
		);
		setParam(
			"month",
			`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
		);
	}

	const monthLabel = focusedMonth.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<div className={styles.monthNav}>
					<button
						className={styles.navButton}
						onClick={() => shiftMonth(-1)}
						aria-label="Previous month"
					>
						<Icon name="chevron-back" size="sm" />
					</button>
					<Text variant="title" as="h1" className={styles.monthLabel}>
						{monthLabel}
					</Text>
					<button
						className={styles.navButton}
						onClick={() => shiftMonth(1)}
						aria-label="Next month"
					>
						<Icon name="chevron-forward" size="sm" />
					</button>
					<Button
						variant="ghost"
						size="small"
						onClick={() => {
							const now = new Date();
							setParam(
								"month",
								`${now.getFullYear()}-${String(
									now.getMonth() + 1,
								).padStart(2, "0")}`,
							);
						}}
					>
						Today
					</Button>
				</div>

				<div className={styles.headerRight}>
					<div className={styles.viewSwitch}>
						{(["month", "list"] as ViewMode[]).map((mode) => (
							<button
								key={mode}
								className={[
									styles.viewButton,
									view === mode ? styles.viewActive : "",
								]
									.filter(Boolean)
									.join(" ")}
								onClick={() => setParam("view", mode)}
								aria-pressed={view === mode}
							>
								<Icon
									name={
										mode === "month"
											? "calendar-outline"
											: "list"
									}
									size="sm"
								/>
								{mode === "month" ? "Month" : "List"}
							</button>
						))}
					</div>
					<Button
						variant="primary"
						icon="add"
						onClick={() => navigate(`/${companyId}/events/new`)}
					>
						New event
					</Button>
				</div>
			</header>

			{/* A running read of the current slice — the phone has nowhere to
			    put this, so an admin never sees the shape of their month. */}
			<div className={styles.stats}>
				<Stat value={stats.events} label="events" />
				<Stat value={stats.assignments} label="assignments" />
				<Stat
					value={stats.unstaffed}
					label="unstaffed"
					tone={stats.unstaffed > 0 ? "warning" : undefined}
				/>
				<Stat
					value={
						stats.confirmRate === null
							? "—"
							: `${stats.confirmRate}%`
					}
					label="confirmed"
				/>
				{!hasLoadedPast && (
					<Button
						variant="ghost"
						size="small"
						icon="time-outline"
						onClick={loadPastEvents}
					>
						Include past
					</Button>
				)}
			</div>

			<div className={styles.body}>
				<FilterRail
					filters={filters}
					onChange={setFilters}
					members={members}
					labels={labels}
				/>

				<Card flush className={styles.viewCard}>
					{error ? (
						/*
						 * A failed query must not look like an empty month. A
						 * missing composite index arrives as failed-precondition
						 * with a console URL in the message, and the app learned
						 * the hard way that swallowing it reads as "no events".
						 */
						<EmptyState
							tone="error"
							title="Could not load events"
							description={String(
								(error as Error)?.message ?? error,
							)}
						/>
					) : view === "month" ? (
						<MonthGrid
							month={focusedMonth}
							events={visible}
							labelsById={labelsById}
							isLoading={isLoading}
						/>
					) : (
						<EventList
							events={visible}
							labelsById={labelsById}
							members={members}
							isLoading={isLoading}
							canViewLabels={
								preferences.canViewEventLabels || true
							}
						/>
					)}
				</Card>

				{/* The event drawer, when /calendar/events/:eventId is open. */}
				<Outlet />
			</div>

			{!isLoading && visible.length === 0 && isFiltered(filters) && (
				<div className={styles.filteredAway}>
					<Text variant="caption" tone="secondary">
						{events.length} event
						{events.length === 1 ? "" : "s"} in this month are
						hidden by your filters.
					</Text>
					<Button
						variant="ghost"
						size="small"
						onClick={() => setFilters(DEFAULT_FILTERS)}
					>
						Clear filters
					</Button>
				</div>
			)}
		</div>
	);
}

function Stat({
	value,
	label,
	tone,
}: {
	value: number | string;
	label: string;
	tone?: "warning";
}) {
	return (
		<span className={styles.stat}>
			<Text
				variant="bodyStrong"
				as="span"
				tone={tone === "warning" ? "warning" : "default"}
			>
				{value}
			</Text>
			<Text variant="caption" tone="tertiary" as="span">
				{label}
			</Text>
		</span>
	);
}

export type { Event };
export { FilterType };
