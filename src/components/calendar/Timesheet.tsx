import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	ActivityIndicator,
	FlatList,
	RefreshControl,
	StyleSheet,
	View,
	ViewToken,
} from "react-native";
import moment from "moment";
import { CalendarList } from "react-native-calendars";
import BottomSheet from "@gorhom/bottom-sheet";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { useEventPrompts } from "../../hooks/useEventPrompts";
import { FilterType } from "../../types";
import {
	Badge,
	Card,
	EmptyState,
	Icon,
	Loading,
	Pressable,
	ScreenHeader,
	Sheet,
	Text,
	useFloatingOffset,
} from "../ui";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { calendarTheme } from "./calendarTheme";

/*
 * The schedule list.
 *
 * Data comes from useCalendarEvents, which queries a bounded date window
 * server-side. v1 pulled the whole Events collection and filtered in JS.
 *
 * The list OPENS ON TODAY. It used to open on the oldest event in the window,
 * because rows are sorted ascending and the window began a month in the past —
 * so the first thing anyone saw was history, and their next shift was somewhere
 * below the fold. `pastWindow: "today"` starts the query at today instead.
 *
 * History is reached by PULLING DOWN, a week per pull. Nothing advertises it
 * from the top of the list: a permanent "show earlier" row would put a control
 * above the one thing this screen exists to answer, which is what you are
 * working next. The badge in the header says how far back the window currently
 * reaches, so the reveal still has a visible edge.
 *
 * The FUTURE extends by scrolling to the bottom, a quarter at a time. The
 * window used to stop dead at MONTHS_AFTER, so anything booked beyond about
 * three months was invisible and the list simply appeared to end.
 */

type Props = {
	filterType: FilterType;
	selectedUsers: string[];
	showAllSelectedOnly: boolean;
	showExactSelectedOnly: boolean;
	navigation: any;
	onCalOpen: () => void;
	onCalClose: () => void;
	selectedDate: string | null;
	setSelectedDate: (date: string | null) => void;
	locked?: boolean;
};

type Entry = {
	id: string;
	title: string;
	hours: number;
	description: string;
	date: string;
	label: string | null;
	isAllDay: boolean;
	startValue: number | null;
};

/* A STRING discriminant, not a boolean. This repo's tsconfig is non-strict,
   where narrowing a union by a boolean literal is unreliable — TypeScript
   widens `true`/`false` back to `boolean` and the union stops discriminating. */
type Row =
	| { kind: "year"; year: number; date: string }
	| { kind: "day"; date: string; entries: Entry[] };

export default function Timesheet(props: Props) {
	const theme = useTheme();
	const styles = useThemedStyles(timesheetStyles);
	const { userId, companyId, user, isAdmin } = useUser();
	const { company } = useCompany();
	const { unconfirmedIds } = useEventPrompts();

	// A selected date anchors the window, so picking a month far away loads
	// that month rather than returning nothing.
	const focusedMonth = useMemo(
		() => (props.selectedDate ? new Date(props.selectedDate) : undefined),
		[props.selectedDate],
	);

	const {
		events,
		agendaItems,
		markedDates,
		labels,
		isLoading,
		error,
		window,
		loadPastEvents,
		clearPastEvents,
		hasLoadedPast,
		loadMore,
		hasMore,
		isLoadingMore,
		upcomingCount,
	} = useCalendarEvents({
		companyId: companyId ?? "",
		userId,
		filterType: props.filterType,
		selectedUsers: props.selectedUsers,
		showAllSelectedOnly: props.showAllSelectedOnly,
		showExactSelectedOnly: props.showExactSelectedOnly,
		focusedMonth,
		pastWindow: "today",
		// Roughly two screens of rows, so reaching the bottom has the next page
		// already on its way rather than starting the fetch from a standstill.
		pageSize: 40,
	});

	/*
	 * Which window we asked to leave behind.
	 *
	 * Tracking the outgoing `from` rather than a plain boolean is what makes the
	 * spinner honest: it clears only once the window has actually moved AND the
	 * new subscription has delivered, so it cannot be cancelled by the render
	 * that happens between those two things.
	 */
	const [pendingFrom, setPendingFrom] = useState<string | null>(null);
	const loadingPast = pendingFrom !== null;

	const onLoadEarlier = useCallback(() => {
		if (pendingFrom !== null) return;
		setPendingFrom(window.from);
		loadPastEvents();
	}, [pendingFrom, window.from, loadPastEvents]);

	useEffect(() => {
		if (pendingFrom !== null && window.from !== pendingFrom && !isLoading) {
			setPendingFrom(null);
		}
	}, [pendingFrom, window.from, isLoading]);

	const rows = useMemo<Row[]>(() => {
		const out: Row[] = [];
		let currentYear: number | null = null;

		const days = Object.keys(agendaItems)
			.filter((day) => !props.selectedDate || day === props.selectedDate)
			.sort();

		for (const day of days) {
			const events = agendaItems[day] ?? [];
			if (!events.length) continue;

			const date = moment(day, "YYYY-MM-DD");
			const year = date.year();
			if (currentYear === null || year !== currentYear) {
				out.push({ kind: "year", year, date: String(year) });
				currentYear = year;
			}

			const entries: Entry[] = events.map((event) => ({
				id: event.uid,
				title: event.title,
				// durationSeconds is an integer; v1 stored hours as a string and
				// parsed it with parseFloat on every render.
				hours: event.durationSeconds
					? Number((event.durationSeconds / 3600).toFixed(1))
					: 0,
				// startAt is already a Date. v1 re-parsed an offset-ISO string
				// with the format "YYYY-MM-DD HH:mm", which moment accepted
				// leniently and resolved to the wrong time.
				description: event.startAt
					? moment(event.startAt).format("h:mm A")
					: "",
				date: day,
				label: event.labelId ? (labels[event.labelId] ?? null) : null,
				isAllDay: event.isAllDay,
				startValue: event.startAt ? event.startAt.getTime() : null,
			}));

			entries.sort((a, b) => {
				if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
				if (a.startValue && b.startValue)
					return a.startValue - b.startValue;
				return a.title.localeCompare(b.title);
			});

			out.push({
				kind: "day",
				date: date.format("MMMM D, YYYY"),
				entries,
			});
		}

		return out;
	}, [agendaItems, labels, props.selectedDate]);

	const totalEvents = useMemo(
		() =>
			rows.reduce(
				(n, row) => (row.kind === "year" ? n : n + row.entries.length),
				0,
			),
		[rows],
	);

	/*
	 * Where "today" lives in the list.
	 *
	 * The first row that is not already behind us — which is today when there is
	 * something on today, and otherwise the next day that has anything. Landing
	 * on the next thing you are actually working is more useful than landing on
	 * an empty date, and rows only exist for days that have events.
	 */
	const todayIndex = useMemo(() => {
		const today = moment().startOf("day");
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			if (row.kind !== "day") continue;
			if (!moment(row.date, "MMMM D, YYYY").isBefore(today)) return i;
		}
		// Everything loaded is in the past; the end of the list is as close to
		// today as this list gets.
		return rows.length - 1;
	}, [rows]);

	/*
	 * onViewableItemsChanged must not change identity — FlatList throws
	 * "Changing onViewableItemsChanged on the fly is not supported" — so the
	 * moving target is read through a ref instead of closed over.
	 */
	const todayIndexRef = useRef(todayIndex);
	useEffect(() => {
		todayIndexRef.current = todayIndex;
	}, [todayIndex]);

	const listRef = useRef<FlatList<Row>>(null);
	/** Which way you would have to travel to get back to today, if it is off screen. */
	const [todayDirection, setTodayDirection] = useState<"up" | "down" | null>(
		null,
	);

	const viewabilityConfig = useRef({
		itemVisiblePercentThreshold: 10,
	}).current;

	const onViewableItemsChanged = useRef(
		({ viewableItems }: { viewableItems: ViewToken[] }) => {
			const target = todayIndexRef.current;
			const indices = viewableItems
				.map((item) => item.index)
				.filter((index): index is number => index !== null);

			if (target < 0 || !indices.length) {
				setTodayDirection(null);
				return;
			}

			const first = Math.min(...indices);
			const last = Math.max(...indices);
			setTodayDirection(
				target < first ? "up" : target > last ? "down" : null,
			);
		},
	).current;

	/*
	 * Fold the revealed history back up.
	 *
	 * `pendingFrom` is dropped too: collapsing restores the window this load
	 * started from, so the "did the window move?" test that normally clears the
	 * spinner would never fire and the refresh control would spin forever.
	 */
	const onClearEarlier = useCallback(() => {
		setPendingFrom(null);
		clearPastEvents();
		listRef.current?.scrollToOffset({ offset: 0, animated: true });
	}, [clearPastEvents]);

	const jumpToToday = useCallback(() => {
		const target = todayIndexRef.current;
		if (target < 0) return;
		listRef.current?.scrollToIndex({
			index: target,
			animated: true,
			viewPosition: 0,
		});
	}, []);

	/*
	 * A picked date filters the list to one day, so the upcoming total would be
	 * answering a different question than the one on screen.
	 */
	const headerCount =
		props.selectedDate || upcomingCount === null
			? totalEvents
			: upcomingCount;

	const sheetRef = useRef<BottomSheet>(null);
	const [calOpen, setCalOpen] = useState(false);

	const openCalendar = () => {
		if (props.locked) return;
		sheetRef.current?.snapToIndex(0);
		setCalOpen(true);
		props.onCalOpen();
	};

	const closeCalendar = () => {
		sheetRef.current?.close();
		setCalOpen(false);
		props.onCalClose();
	};

	const renderDateColumn = (dateLabel: string) => {
		const date = moment(dateLabel, "MMMM D, YYYY");
		const isPast = date.isBefore(moment().startOf("day"));
		const isToday = date.isSame(moment(), "day");

		return (
			<View style={[styles.dateColumn, isPast && styles.past]}>
				<Text variant="caption" color="textSecondary" uppercase>
					{date.format("MMM")}
				</Text>
				<Text
					variant="display"
					color={isToday ? "accent" : "text"}
					style={styles.dateNumber}
				>
					{date.format("D")}
				</Text>
				<Text
					variant="caption"
					color={isToday ? "accent" : "textTertiary"}
					uppercase
				>
					{date.format("ddd")}
				</Text>
			</View>
		);
	};

	const renderEntry = (entry: Entry) => {
		const isPast = moment(entry.date).isBefore(moment().startOf("day"));
		/*
		 * Assigned to this worker and not yet confirmed.
		 *
		 * The Calendar tab badge already says how many there are; this says
		 * WHICH, so someone opening the list to clear the badge can see where
		 * to go instead of tapping through every shift in the week.
		 */
		const needsConfirming = unconfirmedIds.has(entry.id);

		return (
			<Pressable
				key={entry.id}
				onPress={() =>
					props.navigation.navigate("Details", { eventId: entry.id })
				}
				scaleOnPress={false}
				haptic="tap"
				accessibilityLabel={`${entry.title}, ${entry.description || "all day"}${
					needsConfirming ? ", not yet confirmed" : ""
				}`}
				style={[styles.entryCard, isPast && styles.past]}
			>
				{/*
				 * The label's own color, straight from the company's EventLabels —
				 * the one place a non-token color is correct, because the company
				 * chose it.
				 */}
				<View
					style={[
						styles.labelStripe,
						{
							backgroundColor:
								entry.label ?? theme.colors.borderStrong,
						},
					]}
				/>

				<View style={styles.entryContent}>
					<View style={styles.entryTitleRow}>
						<Text
							variant="bodyStrong"
							numberOfLines={2}
							style={styles.flex}
						>
							{entry.title}
						</Text>
						{needsConfirming && (
							<Badge
								label="Confirm"
								tone="warning"
								icon="alert-circle"
							/>
						)}
					</View>

					<View style={styles.entryMeta}>
						<Text variant="caption" color="textSecondary">
							{entry.isAllDay
								? "All day"
								: entry.description || "No time set"}
						</Text>
						{entry.hours > 0 && (
							<>
								<Text variant="caption" color="textTertiary">
									·
								</Text>
								<Text variant="caption" color="accent">
									{entry.hours} hrs
								</Text>
							</>
						)}
					</View>
				</View>
			</Pressable>
		);
	};

	const firstName = user?.firstName ?? "";
	const possessive = firstName.endsWith("s") ? "'" : "'s";

	return (
		<View style={styles.container}>
			<ScreenHeader
				variant="large"
				title={
					firstName
						? `${firstName}${possessive} schedule`
						: "Schedule"
				}
				subtitle={company?.name || undefined}
				actions={[
					{
						icon: calOpen ? "close" : "calendar-outline",
						label: calOpen ? "Close calendar" : "Pick a date",
						onPress: calOpen ? closeCalendar : openCalendar,
					},
				]}
			>
				<View style={styles.headerMeta}>
					{/*
					 * The count of what is COMING UP, from the server — not of
					 * what happens to be loaded. It used to be `rows.length`,
					 * which meant the number climbed as you scrolled and shrank
					 * when you filtered, and never once answered "how many
					 * events do I have".
					 *
					 * Falls back to the loaded count when the aggregate is
					 * unavailable, which is also the case while a JS-only
					 * sub-filter is narrowing the list.
					 */}
					{headerCount > 0 && (
						<Badge
							label={`${headerCount} ${headerCount === 1 ? "event" : "events"}${
								upcomingCount === null ? "" : " upcoming"
							}`}
							tone="accent"
						/>
					)}
					{/* Tapping it folds the revealed history back up — the badge
					    is both the edge of the window and the way to undo it. */}
					{hasLoadedPast && (
						<Pressable
							onPress={onClearEarlier}
							haptic="tap"
							accessibilityLabel={`Showing events back to ${moment(window.from, "YYYY-MM-DD").format("MMMM D")}. Tap to hide past events.`}
						>
							<Badge
								label={`Back to ${moment(window.from, "YYYY-MM-DD").format("MMM D")}`}
								tone="neutral"
								icon="close-circle"
							/>
						</Pressable>
					)}
					{!!props.selectedDate && (
						<Badge
							label={moment(props.selectedDate).format("MMM D")}
							tone="accent"
							variant="solid"
							icon="funnel"
						/>
					)}
				</View>
			</ScreenHeader>

			{/* A failed query is shown rather than swallowed. v1 returned [] on
			    error, so a missing index looked like an empty schedule. */}

			{!!error && (
				<Card style={styles.errorCard}>
					<Text variant="label" color="danger">
						Could not load events
					</Text>
					<Text variant="caption" color="textSecondary">
						{error.message}
					</Text>
				</Card>
			)}

			{isLoading && !rows.length && !hasLoadedPast ? (
				<Loading label="Loading your schedule" />
			) : (
				<FlatList
					ref={listRef}
					data={rows}
					keyExtractor={(item, index) => item.date + index}
					viewabilityConfig={viewabilityConfig}
					onViewableItemsChanged={onViewableItemsChanged}
					onEndReachedThreshold={0.6}
					// loadMore self-guards on hasMore and on a fetch already in
					// flight, so onEndReached firing repeatedly — which it does
					// whenever content is shorter than the screen — is harmless.
					onEndReached={() => {
						if (props.selectedDate) return;
						loadMore();
					}}
					ListFooterComponent={
						props.selectedDate === null ? (
							<ScheduleFooter
								loading={isLoadingMore}
								hasMore={hasMore}
								anyRows={rows.length > 0}
							/>
						) : null
					}
					// Rows are variable height, so scrollToIndex has no layout to
					// work from until the target has been measured. Approximate,
					// let the measurement land, then land it exactly.
					onScrollToIndexFailed={(info) => {
						listRef.current?.scrollToOffset({
							offset: info.averageItemLength * info.index,
							animated: true,
						});
						setTimeout(() => {
							listRef.current?.scrollToIndex({
								index: info.index,
								animated: true,
								viewPosition: 0,
							});
						}, 150);
					}}
					refreshControl={
						props.selectedDate === null ? (
							<RefreshControl
								refreshing={loadingPast}
								onRefresh={onLoadEarlier}
								title="Pull to reveal the week before"
								tintColor={theme.colors.accent}
								titleColor={theme.colors.textSecondary}
							/>
						) : undefined
					}
					ListEmptyComponent={
						error ? null : (
							<EmptyState
								icon="calendar-outline"
								title={
									props.selectedDate
										? "Nothing on this day"
										: "Nothing coming up"
								}
								description={
									props.selectedDate
										? "Pick another date, or clear the filter to see everything."
										: "Events you're scheduled on from today onwards appear here. Pull down to reveal earlier weeks."
								}
							/>
						)
					}
					renderItem={({ item, index }) => {
						if (item.kind === "year") {
							return (
								<View style={styles.yearHeader}>
									<View style={styles.yearLine} />
									<Text
										variant="label"
										color="textSecondary"
										style={styles.yearText}
									>
										{item.year}
									</Text>
									<View style={styles.yearLine} />
								</View>
							);
						}

						const next =
							index < rows.length - 1 ? rows[index + 1] : null;

						return (
							<View style={styles.section}>
								<View style={styles.dateRow}>
									{renderDateColumn(item.date)}
									<View style={styles.entriesContainer}>
										{item.entries.map(renderEntry)}
									</View>
								</View>
								{next?.kind !== "year" && (
									<View style={styles.sectionDivider} />
								)}
							</View>
						);
					}}
					contentContainerStyle={styles.listContent}
					showsVerticalScrollIndicator={false}
				/>
			)}

			{props.selectedDate === null &&
				todayDirection !== null &&
				rows.length > 0 && (
					<JumpToToday
						direction={todayDirection}
						onPress={jumpToToday}
					/>
				)}

			<Sheet
				ref={sheetRef}
				snapPoints={["58%", "92%"]}
				title="Jump to a date"
				onClose={closeCalendar}
			>
				<CalendarList
					markedDates={markedDates}
					date={props.selectedDate ?? undefined}
					pastScrollRange={50}
					futureScrollRange={50}
					scrollEnabled
					onDayPress={(day) => {
						closeCalendar();
						props.setSelectedDate(day.dateString);
					}}
					theme={calendarTheme(theme)}
				/>
			</Sheet>
		</View>
	);
}

/*
 * The end of the list.
 *
 * A spinner while the next page is in flight, and once there are no more pages,
 * a line saying so — otherwise reaching the bottom of an infinite list is
 * indistinguishable from it having quietly failed to load.
 */
function ScheduleFooter({
	loading,
	hasMore,
	anyRows,
}: {
	loading: boolean;
	hasMore: boolean;
	anyRows: boolean;
}) {
	const styles = useThemedStyles(timesheetStyles);
	const theme = useTheme();

	if (loading) {
		return (
			<View style={styles.footer}>
				<ActivityIndicator size="small" color={theme.colors.accent} />
			</View>
		);
	}

	// The empty state already says there is nothing; no need to say it twice.
	if (hasMore || !anyRows) return <View style={styles.footerSpacer} />;

	return (
		<View style={styles.footer}>
			<Text variant="caption" color="textTertiary" style={styles.center}>
				That's everything scheduled
			</Text>
		</View>
	);
}

/*
 * The way back to now.
 *
 * Appears only while today is off screen, and points the way it went: an
 * upward arrow once you have scrolled ahead into next month, a downward one
 * once you have walked back through earlier weeks. A permanent button would be
 * one more thing to read on a list whose whole job is to be scanned.
 */
function JumpToToday({
	direction,
	onPress,
}: {
	direction: "up" | "down";
	onPress: () => void;
}) {
	const styles = useThemedStyles(timesheetStyles);
	const bottom = useFloatingOffset();

	return (
		<View style={[styles.jumpWrap, { bottom }]} pointerEvents="box-none">
			<Pressable
				onPress={onPress}
				haptic="tap"
				accessibilityLabel="Jump to today"
				style={styles.jumpPill}
			>
				<Icon
					name={direction === "up" ? "arrow-up" : "arrow-down"}
					size="sm"
					color="onAccent"
				/>
				<Text variant="label" color="onAccent">
					Today
				</Text>
			</Pressable>
		</View>
	);
}

const timesheetStyles = (theme: Theme) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: theme.colors.bg,
		},
		headerMeta: {
			flexDirection: "row",
			alignItems: "center",
			flexWrap: "wrap",
			gap: theme.spacing.sm,
			paddingHorizontal: theme.spacing.lg,
			paddingBottom: theme.spacing.md,
		},
		alertCard: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.md,
			margin: theme.spacing.lg,
			marginBottom: 0,
			padding: theme.spacing.lg,
			borderRadius: theme.radius.md,
			backgroundColor: theme.colors.dangerSubtle,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.danger,
		},
		alertBody: {
			flex: 1,
			gap: 2,
		},
		errorCard: {
			margin: theme.spacing.lg,
			marginBottom: 0,
			backgroundColor: theme.colors.dangerSubtle,
			borderColor: "transparent",
		},
		listContent: {
			flexGrow: 1,
			paddingTop: theme.spacing.lg,
			paddingBottom: theme.spacing["3xl"] * 2,
		},
		section: {
			marginBottom: theme.spacing.xs,
		},
		dateRow: {
			flexDirection: "row",
			paddingHorizontal: theme.spacing.lg,
		},
		/* Past days recede rather than disappear — they are still tappable. */
		past: {
			opacity: 0.55,
		},
		dateColumn: {
			width: 52,
			alignItems: "center",
			paddingTop: theme.spacing.xs,
		},
		dateNumber: {
			marginVertical: -2,
		},
		entriesContainer: {
			flex: 1,
			marginLeft: theme.spacing.md,
		},
		entryCard: {
			flexDirection: "row",
			backgroundColor: theme.colors.surface,
			borderRadius: theme.radius.md,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.border,
			marginBottom: theme.spacing.sm,
			overflow: "hidden",
		},
		labelStripe: {
			width: 4,
		},
		entryContent: {
			flex: 1,
			padding: theme.spacing.md,
		},
		entryTitleRow: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: theme.spacing.sm,
		},
		flex: {
			flex: 1,
		},
		entryMeta: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.xs + 2,
			marginTop: theme.spacing.xs,
		},
		sectionDivider: {
			height: theme.hairlineWidth,
			backgroundColor: theme.colors.border,
			marginHorizontal: theme.spacing.lg,
			marginVertical: theme.spacing.md,
		},
		yearHeader: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: theme.spacing.xl,
			marginVertical: theme.spacing.lg,
		},
		yearLine: {
			flex: 1,
			height: theme.hairlineWidth,
			backgroundColor: theme.colors.border,
		},
		yearText: {
			marginHorizontal: theme.spacing.md,
		},
		footer: {
			paddingHorizontal: theme.spacing.xl,
			paddingVertical: theme.spacing.lg,
			gap: theme.spacing.xs,
			alignItems: "center",
			minHeight: theme.hitTarget,
		},
		/* Keeps the last row clear of the floating "Today" pill. */
		footerSpacer: {
			height: theme.spacing.xl,
		},
		center: {
			textAlign: "center",
		},
		jumpWrap: {
			position: "absolute",
			left: 0,
			right: 0,
			alignItems: "center",
		},
		jumpPill: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.xs + 2,
			paddingVertical: theme.spacing.sm,
			paddingHorizontal: theme.spacing.lg,
			minHeight: 40,
			borderRadius: theme.radius.pill,
			backgroundColor: theme.colors.accent,
			...theme.elevation.floating,
		},
	});
