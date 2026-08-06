import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import moment from "moment";
import { CalendarList } from "react-native-calendars";
import BottomSheet from "@gorhom/bottom-sheet";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { FilterType } from "../../types";
import {
	Badge,
	Card,
	EmptyState,
	Loading,
	Pressable,
	ScreenHeader,
	Sheet,
	Text,
} from "../ui";
import { Theme, useTheme, useThemedStyles } from "../../theme";
import { calendarTheme } from "./calendarTheme";

/*
 * The schedule list.
 *
 * Data comes from useCalendarEvents, which queries a bounded date window
 * server-side. v1 pulled the whole Events collection and filtered in JS.
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
	const { userId, companyId, user } = useUser();
	const { company } = useCompany();

	// A selected date anchors the window, so picking a month far away loads
	// that month rather than returning nothing.
	const focusedMonth = useMemo(
		() => (props.selectedDate ? new Date(props.selectedDate) : undefined),
		[props.selectedDate],
	);

	const {
		agendaItems,
		markedDates,
		labels,
		isLoading,
		error,
		loadPastEvents,
		hasLoadedPast,
	} = useCalendarEvents({
		companyId: companyId ?? "",
		userId,
		filterType: props.filterType,
		selectedUsers: props.selectedUsers,
		showAllSelectedOnly: props.showAllSelectedOnly,
		showExactSelectedOnly: props.showExactSelectedOnly,
		focusedMonth,
	});

	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = useCallback(() => {
		setRefreshing(true);
		loadPastEvents();
		setRefreshing(false);
	}, [loadPastEvents]);

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

		return (
			<Pressable
				key={entry.id}
				onPress={() =>
					props.navigation.navigate("Details", { eventId: entry.id })
				}
				scaleOnPress={false}
				haptic="tap"
				accessibilityLabel={`${entry.title}, ${entry.description || "all day"}`}
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
					<Text variant="bodyStrong" numberOfLines={2}>
						{entry.title}
					</Text>

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
					{totalEvents > 0 && (
						<Badge
							label={`${totalEvents} ${totalEvents === 1 ? "event" : "events"}`}
							tone="accent"
						/>
					)}
					{hasLoadedPast && (
						<Badge label="Including past" tone="neutral" />
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

			{isLoading && !rows.length ? (
				<Loading label="Loading your schedule" />
			) : (
				<FlatList
					data={rows}
					keyExtractor={(item, index) => item.date + index}
					refreshControl={
						props.selectedDate === null ? (
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								title="Pull to load earlier events"
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
										: "No scheduled events"
								}
								description={
									props.selectedDate
										? "Pick another date, or clear the filter to see everything."
										: "Events you're scheduled on will appear here. Pull down to load earlier ones."
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
	});
