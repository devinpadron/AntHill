import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Event, EventLabel } from "@app/types";
import { useCompany } from "../../contexts/CompanyContext";
import { LoadingPane, MiniBar, Text } from "../../ui";
import styles from "./MonthGrid.module.css";

/*
 * A real seven-column month, sized to the viewport.
 *
 * The phone's calendar shows dots and an agenda list below it — you tap a day
 * to learn anything about it. Here each chip carries time, title, staffed count
 * and response mix on ONE LINE, so a month is readable without interaction. That
 * is the whole argument for the portal in a single screen.
 *
 * Weeks start on the company's `workWeekStarts` preference, the same setting
 * payroll uses — a calendar that disagrees with the payroll week would be worse
 * than no setting at all.
 */

const WEEKDAYS_SUN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Local YYYY-MM-DD. Never toISOString — that shifts the day in most zones. */
function dateKey(date: Date): string {
	return [
		date.getFullYear(),
		String(date.getMonth() + 1).padStart(2, "0"),
		String(date.getDate()).padStart(2, "0"),
	].join("-");
}

export function MonthGrid({
	month,
	events,
	labelsById,
	isLoading,
}: {
	month: Date;
	events: Event[];
	labelsById: Map<string, EventLabel>;
	isLoading: boolean;
}) {
	const { preferences } = useCompany();
	const navigate = useNavigate();
	const [expanded, setExpanded] = useState<string | null>(null);

	const startsMonday = preferences.workWeekStarts === "monday";
	const weekdays = startsMonday
		? [...WEEKDAYS_SUN.slice(1), WEEKDAYS_SUN[0]]
		: WEEKDAYS_SUN;

	const byDate = useMemo(() => {
		const map = new Map<string, Event[]>();
		for (const event of events) {
			const list = map.get(event.dateKey) ?? [];
			list.push(event);
			map.set(event.dateKey, list);
		}
		// Within a day, all-day first then by start time — the order someone
		// actually works them.
		for (const list of map.values()) {
			list.sort((a, b) => {
				if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
				return (
					(a.startAt?.toMillis?.() ?? 0) -
					(b.startAt?.toMillis?.() ?? 0)
				);
			});
		}
		return map;
	}, [events]);

	const cells = useMemo(() => {
		const first = new Date(month.getFullYear(), month.getMonth(), 1);
		const offset = startsMonday
			? (first.getDay() + 6) % 7 // Monday becomes 0
			: first.getDay();

		const start = new Date(first);
		start.setDate(first.getDate() - offset);

		// Six weeks always, so the grid does not change height month to month.
		return Array.from({ length: 42 }, (_, index) => {
			const date = new Date(start);
			date.setDate(start.getDate() + index);
			return date;
		});
	}, [month, startsMonday]);

	if (isLoading && events.length === 0) return <LoadingPane />;

	const todayKey = dateKey(new Date());

	return (
		<div className={styles.wrap}>
			<div className={styles.weekdays}>
				{weekdays.map((day) => (
					<div key={day} className={styles.weekday}>
						{day}
					</div>
				))}
			</div>

			<div className={styles.grid}>
				{cells.map((date) => {
					const key = dateKey(date);
					const inMonth = date.getMonth() === month.getMonth();
					const dayEvents = byDate.get(key) ?? [];
					const isExpanded = expanded === key;
					const shown = isExpanded
						? dayEvents
						: dayEvents.slice(0, 4);
					const staffed = dayEvents.reduce(
						(sum, event) => sum + (event.assignedCount ?? 0),
						0,
					);

					return (
						<div
							key={key}
							className={[
								styles.cell,
								inMonth ? "" : styles.outside,
								key === todayKey ? styles.today : "",
							]
								.filter(Boolean)
								.join(" ")}
						>
							<div className={styles.cellHead}>
								<span
									className={
										key === todayKey
											? styles.todayNumber
											: styles.dayNumber
									}
								>
									{date.getDate()}
								</span>
								{dayEvents.length > 0 && (
									<span className={styles.cellCount}>
										{staffed} staffed
									</span>
								)}
							</div>

							<div className={styles.chips}>
								{shown.map((event) => {
									const label = event.labelId
										? labelsById.get(event.labelId)
										: undefined;
									return (
										<button
											key={event.id}
											className={styles.chip}
											style={{
												borderLeftColor:
													label?.color ??
													"var(--c-border-strong)",
											}}
											onClick={() =>
												navigate(`events/${event.id}`)
											}
											title={`${event.title}${
												label ? ` · ${label.name}` : ""
											}`}
										>
											<span className={styles.chipTime}>
												{event.isAllDay
													? "All day"
													: formatTime(event)}
											</span>
											<span className={styles.chipTitle}>
												{event.title}
											</span>
											<span className={styles.chipMeta}>
												<MiniBar
													width={26}
													confirmed={
														event.responseCounts
															?.confirmed
													}
													pending={
														event.responseCounts
															?.pending
													}
													declined={
														event.responseCounts
															?.declined
													}
													needed={event.assignedCount}
												/>
												<span
													className={
														event.assignedCount
															? styles.count
															: styles.countEmpty
													}
												>
													{event.assignedCount ?? 0}
												</span>
											</span>
										</button>
									);
								})}

								{dayEvents.length > shown.length && (
									<button
										className={styles.more}
										onClick={() => setExpanded(key)}
									>
										+{dayEvents.length - shown.length} more
									</button>
								)}
								{isExpanded && dayEvents.length > 4 && (
									<button
										className={styles.more}
										onClick={() => setExpanded(null)}
									>
										Show less
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function formatTime(event: Event): string {
	const start = event.startAt?.toDate?.();
	if (!start) return "";
	return start.toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}
