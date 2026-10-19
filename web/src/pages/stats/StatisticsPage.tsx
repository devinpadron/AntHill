import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCompanyMembers } from "@app/hooks/useCompanyMembers";
import { useUserStats } from "@app/hooks/useUserStats";
import { getConnections } from "@app/services/timeEntryEditService";
import { formatDuration } from "@app/utils/timeUtils";
import {
	ALL_TIME,
	formatClock,
	formatDateKey,
	type UserStats,
	type YearKey,
} from "@app/utils/statsUtils";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import { Button, Card, EmptyState, LoadingPane, Select, Text } from "../../ui";
import styles from "./StatisticsPage.module.css";

/*
 * One person's numbers, per year and all-time. Mirrors the app's Statistics
 * screen, which a manager can point at anyone on the roster.
 *
 * `useUserStats` and `statsUtils` are the app's own: two full-history sweeps,
 * then arithmetic. The year selector never touches the network, and the hook
 * caches on disk through kvStore (localStorage here), so returning to the page
 * is instant.
 *
 * Whose numbers lives in the URL (`?user=`), so a manager can send a colleague
 * a link to one worker's year.
 */
export function StatisticsPage() {
	const { companyId, timeZone, preferences } = useCompany();
	const { userId } = useAuth();
	const { members } = useCompanyMembers(companyId);
	const [params, setParams] = useSearchParams();

	const subjectId = params.get("user") || userId;
	const subject = members.find((m) => m.userId === subjectId);
	const isSelf = subjectId === userId;
	const subjectName = subject?.firstName || "This worker";
	const whose = isSelf ? "Your" : `${subjectName}'s`;
	const whoseLower = isSelf ? "your" : `${subjectName}'s`;

	const { years, isLoading, truncated, hasAnyData, statsFor, refresh } =
		useUserStats(companyId, subjectId, timeZone);

	/*
	 * Null means "whatever the newest year is". Derived rather than seeded by
	 * an effect, so the first render after the sweep already shows a year.
	 */
	const [picked, setPicked] = useState<YearKey | null>(null);
	const year = picked ?? years[0] ?? ALL_TIME;
	const [refreshing, setRefreshing] = useState(false);

	const choosePerson = (nextUserId: string) => {
		const next = new URLSearchParams(params);
		if (nextUserId === userId) next.delete("user");
		else next.set("user", nextUserId);
		setParams(next, { replace: true });
		// Their years are not this person's years.
		setPicked(null);
	};

	const picker = (
		<div className={styles.toolbar}>
			<Select
				value={subjectId}
				onChange={(e) => choosePerson(e.target.value)}
				aria-label="Whose statistics"
			>
				{members.map((member) => (
					<option key={member.userId} value={member.userId}>
						{member.displayName}
						{member.userId === userId ? " (you)" : ""}
					</option>
				))}
			</Select>
			{years.length > 1 && (
				<Select
					value={year}
					onChange={(e) => setPicked(e.target.value)}
					aria-label="Period"
				>
					<option value={ALL_TIME}>All time</option>
					{years.map((value) => (
						<option key={value} value={value}>
							{value}
						</option>
					))}
				</Select>
			)}
			<Button
				variant="ghost"
				size="small"
				icon="refresh"
				busy={refreshing}
				onClick={() => {
					setRefreshing(true);
					void refresh().finally(() => setRefreshing(false));
				}}
			>
				Refresh
			</Button>
		</div>
	);

	const header = (
		<header className={styles.header}>
			<Text variant="display" as="h1">
				Statistics
			</Text>
			{picker}
		</header>
	);

	if (isLoading) {
		return (
			<div className={styles.page}>
				{header}
				<LoadingPane label="Adding up every shift" />
			</div>
		);
	}

	if (!hasAnyData) {
		return (
			<div className={styles.page}>
				{header}
				<EmptyState
					icon="stats-chart-outline"
					title="Nothing to show yet"
					description={
						isSelf
							? "Work a shift and your stats will start filling in."
							: `${subjectName} has not worked a shift yet.`
					}
				/>
			</div>
		);
	}

	const stats = statsFor(year);
	const period = year === ALL_TIME ? "all time" : year;

	/*
	 * Hours lead when there are any — that is what someone came here for. A
	 * company that does not clock in gets its event count in the hero instead
	 * of a confident "0h 0m".
	 */
	const hasHours = stats.shiftCount > 0;

	return (
		<div className={styles.page}>
			{header}

			<Card>
				<div className={styles.hero}>
					<Text variant="display">
						{hasHours
							? formatDuration(stats.totalSeconds)
							: String(stats.eventsWorked)}
					</Text>
					<Text variant="caption" tone="secondary">
						{hasHours
							? `worked over ${period} · ${plural(stats.shiftCount, "shift")}`
							: `${plural(stats.eventsWorked, "event")} worked over ${period}`}
					</Text>
				</div>
			</Card>

			<div className={styles.grid}>
				<Highlights
					stats={stats}
					entryHref={
						// The payroll page only exists when timesheets are on,
						// and a company can switch the feature off with entries
						// already written — so the link has to check.
						preferences.enableTimeSheet && stats.longestShift
							? `/${companyId}/payroll/entries/${stats.longestShift.entryId}`
							: undefined
					}
				/>

				{hasHours && (
					<Card title="Hours">
						<dl className={styles.rows}>
							<Row
								label="Total worked"
								value={formatDuration(stats.totalSeconds)}
							/>
							<Row
								label="Shifts"
								value={String(stats.shiftCount)}
							/>
							<Row
								label="Days on the clock"
								value={plural(stats.daysWorked, "day")}
							/>
							{stats.averageShiftSeconds !== null && (
								<Row
									label="Average shift"
									value={formatDuration(
										stats.averageShiftSeconds,
									)}
								/>
							)}
							{stats.totalPausedSeconds > 0 && (
								<Row
									label="Time on break"
									value={formatDuration(
										stats.totalPausedSeconds,
									)}
								/>
							)}
							<Row
								label="Round the clock"
								hint={`${whose} hours as whole 24-hour days`}
								value={`${stats.equivalentFullDays.toFixed(1)} days`}
							/>
						</dl>
					</Card>
				)}

				{hasHours && (
					<Card title={`${whose} rhythm`}>
						<dl className={styles.rows}>
							{stats.busiestMonth && (
								<Row
									label="Busiest month"
									value={stats.busiestMonth.label}
									hint={plural(
										stats.busiestMonth.count,
										"shift",
									)}
								/>
							)}
							{stats.busiestWeekday && (
								<Row
									label="Favourite day"
									value={stats.busiestWeekday.label}
									hint={plural(
										stats.busiestWeekday.count,
										"shift",
									)}
								/>
							)}
							{stats.shortestShift && (
								<Row
									label="Shortest shift"
									value={formatDuration(
										stats.shortestShift.seconds,
									)}
									hint={formatDateKey(
										stats.shortestShift.dateKey,
									)}
								/>
							)}
							{stats.firstShiftDateKey && (
								<Row
									label={
										year === ALL_TIME
											? "First ever shift"
											: "First shift of the year"
									}
									value={formatDateKey(
										stats.firstShiftDateKey,
									)}
								/>
							)}
						</dl>
					</Card>
				)}

				{stats.eventsWorked > 0 && (
					<Card title="Events">
						<dl className={styles.rows}>
							<Row
								label="Events worked"
								value={String(stats.eventsWorked)}
							/>
							{stats.longestEvent && (
								<Row
									label="Longest event"
									value={formatDuration(
										stats.longestEvent.value,
									)}
									hint={stats.longestEvent.title}
								/>
							)}
							{stats.topVenue && (
								<Row
									label="Most-visited place"
									value={stats.topVenue.label}
									hint={`${stats.topVenue.count} times`}
								/>
							)}
							{stats.busiestEventMonth && (
								<Row
									label="Busiest month"
									value={stats.busiestEventMonth.label}
									hint={plural(
										stats.busiestEventMonth.count,
										"event",
									)}
								/>
							)}
						</dl>
					</Card>
				)}
			</div>

			<Text variant="caption" tone="tertiary" align="center">
				{truncated
					? `Based on ${whoseLower} most recent 2,000 records.`
					: `Counts every shift and event on ${whoseLower} record.`}
			</Text>
		</div>
	);
}

/**
 * The fun bit. Rows with nothing to show are dropped rather than rendered as a
 * dash, so a first-week hire sees two highlights instead of six blanks.
 */
function Highlights({
	stats,
	entryHref,
}: {
	stats: UserStats;
	entryHref?: string;
}) {
	const eventTitle = useLongestShiftEvent(stats.longestShift?.entryId);

	const rows: {
		key: string;
		emoji: string;
		label: string;
		value: string;
		caption?: string;
		href?: string;
	}[] = [];

	if (stats.longestShift) {
		rows.push({
			key: "longest",
			emoji: "🏆",
			label: "Longest shift",
			value: formatDuration(stats.longestShift.seconds),
			caption: [eventTitle, formatDateKey(stats.longestShift.dateKey)]
				.filter(Boolean)
				.join(" · "),
			href: entryHref,
		});
	}
	if (stats.longestStreak && stats.longestStreak.days > 1) {
		const streak = stats.longestStreak;
		rows.push({
			key: "streak",
			emoji: "🔥",
			label: "Longest streak",
			value: plural(streak.days, "day"),
			caption: `${formatDateKey(streak.fromDateKey, false)} – ${formatDateKey(streak.toDateKey)}`,
		});
	}
	if (stats.currentStreak > 1) {
		rows.push({
			key: "current",
			emoji: "⚡",
			label: "On a roll",
			value: plural(stats.currentStreak, "day"),
			caption: "Days in a row, right now",
		});
	}
	if (stats.latestFinish) {
		rows.push({
			key: "latest",
			emoji: "🌙",
			label: "Latest finish",
			value: formatClock(stats.latestFinish.minutesOfDay),
			caption: formatDateKey(stats.latestFinish.dateKey),
		});
	}
	if (stats.earliestStart) {
		rows.push({
			key: "earliest",
			emoji: "🌅",
			label: "Earliest start",
			value: formatClock(stats.earliestStart.minutesOfDay),
			caption: formatDateKey(stats.earliestStart.dateKey),
		});
	}
	if (stats.biggestCrew) {
		rows.push({
			key: "crew",
			emoji: "👥",
			label: "Biggest crew",
			value: plural(stats.biggestCrew.value, "person", "people"),
			caption: `${stats.biggestCrew.title} · ${formatDateKey(stats.biggestCrew.dateKey)}`,
		});
	}

	if (!rows.length) return null;

	return (
		<Card title="The highlights">
			<ul className={styles.highlights}>
				{rows.map((row) => {
					const body = (
						<>
							<span className={styles.emoji}>{row.emoji}</span>
							<span className={styles.highlightText}>
								<Text variant="body" as="span">
									{row.label}
								</Text>
								{row.caption && (
									<Text
										variant="caption"
										tone="secondary"
										as="span"
										clamp={1}
									>
										{row.caption}
									</Text>
								)}
							</span>
							<Text variant="bodyStrong" as="span">
								{row.value}
							</Text>
						</>
					);
					return (
						<li key={row.key}>
							{row.href ? (
								<Link
									to={row.href}
									className={styles.highlight}
								>
									{body}
								</Link>
							) : (
								<div className={styles.highlight}>{body}</div>
							)}
						</li>
					);
				})}
			</ul>
		</Card>
	);
}

/**
 * What the longest shift was actually spent on — one read of the entry's
 * `connections` subcollection, cached by entry id across year switches.
 */
function useLongestShiftEvent(entryId?: string): string | null {
	const cache = useMemo(() => new Map<string, string | null>(), []);
	const [title, setTitle] = useState<string | null>(null);

	useEffect(() => {
		if (!entryId) {
			setTitle(null);
			return;
		}
		if (cache.has(entryId)) {
			setTitle(cache.get(entryId) ?? null);
			return;
		}
		let cancelled = false;
		setTitle(null);
		void getConnections(entryId).then((connections) => {
			const first = connections[0];
			const resolved =
				first?.customTitle || first?.eventTitleSnapshot || null;
			cache.set(entryId, resolved);
			if (!cancelled) setTitle(resolved);
		});
		return () => {
			cancelled = true;
		};
	}, [entryId, cache]);

	return title;
}

function Row({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className={styles.row}>
			<dt>
				<Text variant="body" as="span">
					{label}
				</Text>
				{hint && (
					<Text variant="caption" tone="tertiary" as="span">
						{hint}
					</Text>
				)}
			</dt>
			<dd>
				<Text variant="bodyStrong" as="span">
					{value}
				</Text>
			</dd>
		</div>
	);
}

/** "1 shift" / "6 shifts", so no label has to read "1 shifts". */
function plural(count: number, singular: string, many?: string): string {
	const word = count === 1 ? singular : (many ?? `${singular}s`);
	return `${count.toLocaleString()} ${word}`;
}
