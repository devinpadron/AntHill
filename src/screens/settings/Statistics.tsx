import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useUserStats } from "../../hooks/useUserStats";
import { getConnections } from "../../services/timeEntryEditService";
import { formatDuration } from "../../utils/timeUtils";
import {
	ALL_TIME,
	formatClock,
	formatDateKey,
	UserStats,
	YearKey,
} from "../../utils/statsUtils";
import {
	Card,
	EmptyState,
	ListRow,
	Screen,
	ScreenHeader,
	SegmentedControl,
	Sheet,
	SkeletonList,
	Text,
} from "../../components/ui";
import { useTheme, useThemedStyles } from "../../theme";
import { statisticsStyles } from "./Statistics.styles";

/*
 * A worker's own numbers, per year and all-time.
 *
 * Everything the app showed a worker about their own hours was one week wide —
 * the Clock tab's weekly total and nothing else. All of the history was already
 * in Firestore and nothing ever looked back over it.
 *
 * Not gated on isAdmin: these are the reader's own hours, and there is nothing
 * here a manager should see that the person who worked them should not.
 *
 * Event stats are separate from hour stats on purpose. A company with
 * `enableTimeSheet` off has no time entries at all, and this page still has
 * something true to say to them.
 */
const Statistics = ({ navigation }: any) => {
	const styles = useThemedStyles(statisticsStyles);
	const theme = useTheme();
	const { userId, companyId } = useUser();
	const { timeZone, preferences } = useCompany();

	const { years, isLoading, truncated, hasAnyData, statsFor, refresh } =
		useUserStats(companyId, userId, timeZone);

	/*
	 * Two controls, not one row of every year.
	 *
	 * A segment per year meant the picker grew by one every January, and it had
	 * already outgrown the screen — hence the horizontal scroller it used to sit
	 * in, which hid the older years behind a swipe nobody knew to make. The
	 * scope question ("everything, or one year?") is now separate from the
	 * which-year question, so the first control stays two segments wide forever
	 * and the second scales to any amount of history.
	 */
	const [scope, setScope] = useState<"all" | "year">("year");

	/*
	 * Null means "whatever the newest year is". Derived rather than seeded by an
	 * effect, so the first render after the sweep lands already shows a year
	 * instead of flashing an empty all-time view.
	 */
	const [picked, setPicked] = useState<YearKey | null>(null);
	const newestYear = years[0] ?? ALL_TIME;
	const selectedYear = picked ?? newestYear;
	const year = scope === "all" ? ALL_TIME : selectedYear;

	const yearSheetRef = useRef<BottomSheet>(null);
	const openYearPicker = useCallback(() => {
		yearSheetRef.current?.snapToIndex(0);
	}, []);
	const closeYearPicker = useCallback(() => {
		yearSheetRef.current?.close();
	}, []);
	const chooseYear = useCallback(
		(value: YearKey) => {
			setPicked(value);
			closeYearPicker();
		},
		[closeYearPicker],
	);

	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = async () => {
		setRefreshing(true);
		try {
			await refresh();
		} finally {
			setRefreshing(false);
		}
	};

	const header = (
		<ScreenHeader title="Statistics" onBack={() => navigation.goBack()} />
	);

	if (isLoading) {
		return (
			<Screen header={header}>
				<SkeletonList rows={6} />
			</Screen>
		);
	}

	if (!hasAnyData) {
		return (
			<Screen header={header}>
				<EmptyState
					icon="stats-chart-outline"
					title="Nothing to show yet"
					description="Work a shift and your stats will start filling in."
				/>
			</Screen>
		);
	}

	const stats = statsFor(year);
	const period = year === ALL_TIME ? "all time" : year;

	/*
	 * The year control is pointless with nothing to choose between — one year of
	 * history means "By year" and "All time" are the same numbers.
	 */
	const canPickYear = years.length > 1;

	/*
	 * Which total leads.
	 *
	 * Hours, when there are any — that is what someone came here for. A company
	 * that does not clock in gets its event count in the hero instead of a
	 * confident "0h 0m".
	 */
	const hasHours = stats.shiftCount > 0;

	return (
		/*
		 * The sheet is a SIBLING of Screen, not a child.
		 *
		 * `Screen scroll` renders its children inside a ScrollView, and a bottom
		 * sheet placed there is laid out within the scroll CONTENT rather than
		 * over the window — it positions itself absolutely against the scrolling
		 * view, so tapping the row appeared to do nothing at all. Same reason
		 * CompanySwitcher hangs its sheet off the provider instead of the page.
		 *
		 * The flex wrapper is load-bearing too: gorhom measures its container to
		 * work out where the snap points are, so the sheet needs a parent with a
		 * real height.
		 */
		<View style={styles.flex}>
			<Screen
				scroll
				padded
				header={header}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						tintColor={theme.colors.accent}
					/>
				}
			>
				<Card style={styles.card}>
					<View style={styles.hero}>
						<Text variant="display">
							{hasHours
								? formatDuration(stats.totalSeconds)
								: String(stats.eventsWorked)}
						</Text>
						<Text
							variant="caption"
							color="textSecondary"
							align="center"
							style={styles.heroCaption}
						>
							{hasHours
								? `worked over ${period} · ${plural(stats.shiftCount, "shift")}`
								: `${plural(stats.eventsWorked, "event")} worked over ${period}`}
						</Text>
					</View>
				</Card>

				{canPickYear && (
					<View style={styles.scopeBlock}>
						<SegmentedControl<"all" | "year">
							segments={[
								{ value: "year", label: "By year" },
								{ value: "all", label: "All time" },
							]}
							value={scope}
							onChange={setScope}
						/>

						{scope === "year" && (
							<Card flush>
								<ListRow
									title="Year"
									value={selectedYear}
									icon="calendar-outline"
									onPress={openYearPicker}
								/>
							</Card>
						)}
					</View>
				)}

				<Highlights
					stats={stats}
					onOpenShift={
						// The Clock tab only exists when timesheets are on, and a
						// company can switch the feature off with entries already
						// written — so the tap-through has to check, not assume.
						preferences.enableTimeSheet && stats.longestShift
							? () =>
									navigation.navigate("Clock", {
										screen: "TimeEntryDetails",
										params: {
											entryId:
												stats.longestShift!.entryId,
											userId,
										},
									})
							: undefined
					}
				/>

				{hasHours && (
					<Card title="Hours" flush style={styles.card}>
						<ListRow
							title="Total worked"
							value={formatDuration(stats.totalSeconds)}
						/>
						<ListRow
							title="Shifts"
							value={String(stats.shiftCount)}
						/>
						<ListRow
							title="Days on the clock"
							value={plural(stats.daysWorked, "day")}
						/>
						{stats.averageShiftSeconds !== null && (
							<ListRow
								title="Average shift"
								value={formatDuration(
									stats.averageShiftSeconds,
								)}
							/>
						)}
						{stats.totalPausedSeconds > 0 && (
							<ListRow
								title="Time on break"
								value={formatDuration(stats.totalPausedSeconds)}
							/>
						)}
						<ListRow
							title="Round the clock"
							subtitle="Your hours as whole 24-hour days"
							value={`${stats.equivalentFullDays.toFixed(1)} days`}
							separator={false}
						/>
					</Card>
				)}

				{hasHours && (
					<Card title="Your rhythm" flush style={styles.card}>
						{stats.busiestMonth && (
							<ListRow
								title="Busiest month"
								value={stats.busiestMonth.label}
								subtitle={plural(
									stats.busiestMonth.count,
									"shift",
								)}
							/>
						)}
						{stats.busiestWeekday && (
							<ListRow
								title="Favourite day"
								value={stats.busiestWeekday.label}
								subtitle={plural(
									stats.busiestWeekday.count,
									"shift",
								)}
							/>
						)}
						{stats.shortestShift && (
							<ListRow
								title="Shortest shift"
								value={formatDuration(
									stats.shortestShift.seconds,
								)}
								subtitle={formatDateKey(
									stats.shortestShift.dateKey,
								)}
							/>
						)}
						{stats.firstShiftDateKey && (
							<ListRow
								title={
									year === ALL_TIME
										? "First ever shift"
										: "First shift of the year"
								}
								value={formatDateKey(stats.firstShiftDateKey)}
								separator={false}
							/>
						)}
					</Card>
				)}

				{stats.eventsWorked > 0 && (
					<Card title="Events" flush style={styles.card}>
						<ListRow
							title="Events worked"
							value={String(stats.eventsWorked)}
						/>
						{stats.longestEvent && (
							<ListRow
								title="Longest event"
								value={formatDuration(stats.longestEvent.value)}
								subtitle={stats.longestEvent.title}
							/>
						)}
						{stats.topVenue && (
							<ListRow
								title="Most-visited place"
								value={stats.topVenue.label}
								subtitle={`${stats.topVenue.count} times`}
							/>
						)}
						{stats.busiestEventMonth && (
							<ListRow
								title="Busiest month"
								value={stats.busiestEventMonth.label}
								subtitle={plural(
									stats.busiestEventMonth.count,
									"event",
								)}
								separator={false}
							/>
						)}
					</Card>
				)}

				<View style={styles.footnote}>
					<Text variant="caption" color="textTertiary" align="center">
						{truncated
							? "Based on your most recent 2,000 records."
							: "Counts every shift and event on your record."}
					</Text>
				</View>
			</Screen>

			{/*
			 * A sheet rather than a row of segments, because this list only ever
			 * grows. It scrolls, so a worker of ten years' standing picks 2019
			 * exactly as easily as last year.
			 */}
			<Sheet
				ref={yearSheetRef}
				snapPoints={["50%"]}
				title="Choose a year"
				onClose={closeYearPicker}
			>
				<BottomSheetScrollView>
					{years.map((value, index) => (
						<ListRow
							key={value}
							title={value}
							icon={
								value === selectedYear
									? "calendar"
									: "calendar-outline"
							}
							iconColor={
								value === selectedYear
									? "accent"
									: "textSecondary"
							}
							selected={value === selectedYear}
							separator={index < years.length - 1}
							onPress={() => chooseYear(value)}
						/>
					))}
				</BottomSheetScrollView>
			</Sheet>
		</View>
	);
};

/**
 * The fun bit.
 *
 * Deliberately not `ListRow`s: these lead with an emoji rather than an Ionicon,
 * and the value carries more weight than a settings value does. Rows with
 * nothing to show are dropped rather than rendered as a dash, so a first-week
 * hire sees two highlights instead of six blanks.
 */
const Highlights = ({
	stats,
	onOpenShift,
}: {
	stats: UserStats;
	onOpenShift?: () => void;
}) => {
	const styles = useThemedStyles(statisticsStyles);
	const eventTitle = useLongestShiftEvent(stats.longestShift?.entryId);

	const rows: {
		key: string;
		emoji: string;
		label: string;
		value: string;
		caption?: string;
		onPress?: () => void;
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
			onPress: onOpenShift,
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
		<>
			<Text
				variant="overline"
				color="textSecondary"
				uppercase
				style={styles.sectionTitle}
			>
				The highlights
			</Text>

			<Card flush>
				{rows.map((row, index) => (
					<View key={row.key}>
						<View style={styles.highlight}>
							<View style={styles.emojiSlot}>
								<Text variant="heading">{row.emoji}</Text>
							</View>

							<View style={styles.highlightText}>
								<Text variant="body">{row.label}</Text>
								{!!row.caption && (
									<Text
										variant="caption"
										color="textSecondary"
										numberOfLines={1}
										style={styles.highlightCaption}
									>
										{row.caption}
									</Text>
								)}
							</View>

							<Text
								variant="bodyStrong"
								style={styles.highlightValue}
							>
								{row.value}
							</Text>
						</View>

						{index < rows.length - 1 && (
							<View style={styles.separator} />
						)}
					</View>
				))}
			</Card>
		</>
	);
};

/**
 * What the longest shift was actually spent on.
 *
 * The link lives in the entry's `connections` subcollection, so it costs one
 * read — cached by entry id, because switching years usually lands on a shift
 * already looked up, and switching back always does.
 */
function useLongestShiftEvent(entryId?: string): string | null {
	const cache = useRef(new Map<string, string | null>());
	const [title, setTitle] = useState<string | null>(
		entryId ? (cache.current.get(entryId) ?? null) : null,
	);

	useEffect(() => {
		if (!entryId) {
			setTitle(null);
			return;
		}

		if (cache.current.has(entryId)) {
			setTitle(cache.current.get(entryId) ?? null);
			return;
		}

		let cancelled = false;
		setTitle(null);

		getConnections(entryId).then((connections) => {
			const first = connections[0];
			const resolved =
				first?.customTitle || first?.eventTitleSnapshot || null;

			cache.current.set(entryId, resolved);
			if (!cancelled) setTitle(resolved);
		});

		return () => {
			cancelled = true;
		};
	}, [entryId]);

	return title;
}

/** "1 shift" / "6 shifts", so no label has to read "1 shifts". */
function plural(count: number, singular: string, many?: string): string {
	const word = count === 1 ? singular : (many ?? `${singular}s`);
	return `${count.toLocaleString()} ${word}`;
}

export default Statistics;
