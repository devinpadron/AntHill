import React, { useCallback, useMemo, useState } from "react";
import {
	FlatList,
	RefreshControl,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import { CalendarList } from "react-native-calendars";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useUser } from "../../../contexts/v2/UserContext";
import { useCompany } from "../../../contexts/v2/CompanyContext";
import { useCalendarEvents } from "../../../hooks/v2/useCalendarEvents";
import { FilterType } from "../../../types";
import LoadingScreen from "../../../screens/LoadingScreen";

/*
 * The schedule list.
 *
 * Data comes from useCalendarEvents, which queries a bounded date window
 * server-side. v1 pulled the whole Events collection and filtered in JS.
 *
 * Presentation is deliberately unchanged — same layout, same styles — so that
 * anything that looks different is a data bug, not a restyle.
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

	const [calOpen, setCalOpen] = useState(false);
	const [calIndex, setCalIndex] = useState(-1);

	const toggleCalendar = (close?: number) => {
		if (props.locked) return;
		if (calOpen || close === 0) {
			setCalOpen(false);
			setCalIndex(-1);
			props.onCalClose();
		} else {
			setCalIndex(1);
			setCalOpen(true);
			props.onCalOpen();
		}
	};

	const renderDateColumn = (dateLabel: string) => {
		const date = moment(dateLabel, "MMMM D, YYYY");
		return (
			<View
				style={[
					styles.sectionHeader,
					date.isBefore(moment().startOf("day")) && { opacity: 0.5 },
				]}
			>
				<View style={styles.dateNumberContainer}>
					<View style={styles.dateTextContainer}>
						<Text style={styles.dateMonth}>
							{date.format("MMM")}
						</Text>
					</View>
					<Text style={styles.dateNumber}>{date.format("D")}</Text>
					<View style={styles.dateTextContainer}>
						<Text style={styles.dateDay}>{date.format("ddd")}</Text>
					</View>
				</View>
				<View style={styles.headerSpacer} />
			</View>
		);
	};

	const renderEntry = (entry: Entry) => (
		<TouchableOpacity
			onPress={() =>
				props.navigation.navigate("Details", { eventId: entry.id })
			}
		>
			<View
				style={[
					styles.entryCard,
					moment(entry.date).isBefore(moment().startOf("day")) && {
						opacity: 0.5,
					},
				]}
			>
				{entry.label && (
					<View
						style={[
							styles.labelIndicator,
							{ backgroundColor: entry.label },
						]}
					/>
				)}
				<View style={styles.entryContent}>
					<Text
						style={styles.projectName}
						numberOfLines={2}
						ellipsizeMode="tail"
					>
						{entry.title}
					</Text>
					{entry.description ? (
						<Text style={styles.entryDescription}>
							{entry.description}
						</Text>
					) : null}
					{entry.hours > 0 && (
						<Text style={styles.hoursValue}>{entry.hours} hrs</Text>
					)}
				</View>
			</View>
		</TouchableOpacity>
	);

	if (isLoading && !rows.length) return <LoadingScreen />;

	const firstName = user?.firstName ?? "";
	const possessive = firstName.endsWith("s") ? "'" : "'s";

	return (
		<View style={styles.container}>
			<StatusBar barStyle="dark-content" />

			<View style={styles.header}>
				<View>
					<Text style={styles.headerTitle}>
						{company?.name || "Company"}
					</Text>
					<Text style={styles.headerTitle}>
						{firstName}
						{possessive} Schedule
					</Text>
					{totalEvents > 0 && (
						<View style={styles.eventCountContainer}>
							<Text style={styles.eventCountText}>
								{totalEvents}{" "}
								{totalEvents === 1 ? "event" : "events"}
							</Text>
						</View>
					)}
				</View>
				<TouchableOpacity
					style={styles.headerButton}
					onPress={() => toggleCalendar()}
				>
					<Ionicons name="calendar" size={24} color="#007AFF" />
				</TouchableOpacity>
			</View>

			{/* A failed query is shown rather than swallowed. v1 returned [] on
			    error, so a missing index looked like an empty schedule. */}
			{error && (
				<View style={styles.errorBanner}>
					<Text style={styles.errorText}>
						Could not load events: {error.message}
					</Text>
				</View>
			)}

			{hasLoadedPast && (
				<View style={styles.pastEventsIndicator}>
					<Text style={styles.pastEventsText}>
						Showing past events
					</Text>
				</View>
			)}

			{!error && rows.length === 0 && (
				<View style={styles.pastEventsIndicator}>
					<Text style={styles.pastEventsText}>
						No scheduled events
					</Text>
				</View>
			)}

			<FlatList
				data={rows}
				keyExtractor={(item, index) => item.date + index}
				refreshControl={
					props.selectedDate === null ? (
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							title="Pull to load earlier events"
							tintColor="#007AFF"
						/>
					) : undefined
				}
				renderItem={({ item, index }) => {
					if (item.kind === "year") {
						return (
							<View style={styles.yearHeader}>
								<View style={styles.yearLine} />
								<Text style={styles.yearText}>{item.year}</Text>
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
									{item.entries.map((entry) => (
										<View key={entry.id}>
											{renderEntry(entry)}
										</View>
									))}
								</View>
							</View>
							{next?.kind !== "year" && (
								<View style={styles.sectionDivider} />
							)}
						</View>
					);
				}}
				contentContainerStyle={styles.listContent}
			/>

			<BottomSheet
				snapPoints={["50%", "90%"]}
				enablePanDownToClose
				index={calIndex}
				onClose={() => toggleCalendar(0)}
			>
				<BottomSheetView style={styles.modalContainer}>
					<CalendarList
						markedDates={markedDates}
						date={props.selectedDate ?? undefined}
						pastScrollRange={50}
						futureScrollRange={50}
						scrollEnabled
						onDayPress={(day) => {
							toggleCalendar();
							props.setSelectedDate(day.dateString);
						}}
						theme={{
							calendarBackground: "#fff",
							textSectionTitleColor: "#b6c1cd",
							selectedDayBackgroundColor: "#007AFF",
							selectedDayTextColor: "#ffffff",
							todayTextColor: "#007AFF",
							dayTextColor: "#2d4150",
							textDisabledColor: "#d9e1e8",
							dotColor: "#007AFF",
							selectedDotColor: "#ffffff",
							arrowColor: "#007AFF",
							monthTextColor: "#2d4150",
							indicatorColor: "#007AFF",
							textDayFontWeight: "300",
							textMonthFontWeight: "bold",
							textDayHeaderFontWeight: "300",
						}}
					/>
				</BottomSheetView>
			</BottomSheet>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F7F7F9" },
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#F7F7F9",
	},
	headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
	headerButton: { padding: 8 },
	listContent: { paddingBottom: 20 },
	section: { marginVertical: 4 },
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		marginBottom: 8,
	},
	entriesContainer: {
		paddingLeft: 0,
		paddingRight: 12,
		marginBottom: 0,
		width: "75%",
	},
	entryCard: {
		backgroundColor: "white",
		borderRadius: 10,
		marginBottom: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		flexDirection: "row",
		overflow: "hidden",
	},
	dateNumberContainer: {
		width: 50,
		alignItems: "center",
		flexDirection: "column",
	},
	dateNumber: {
		fontSize: 32,
		fontWeight: "300",
		color: "#333",
		marginBottom: 2,
	},
	dateTextContainer: { flexDirection: "row", alignItems: "center" },
	dateDay: { fontSize: 14, color: "#666", marginRight: 4 },
	dateMonth: { fontSize: 14, color: "#666", fontWeight: "500" },
	projectName: {
		fontSize: 16,
		fontWeight: "500",
		color: "#333",
		marginBottom: 0,
	},
	entryDescription: {
		fontSize: 14,
		color: "#666",
		marginBottom: 0,
		marginTop: 6,
	},
	hoursValue: {
		fontSize: 14,
		color: "#007AFF",
		fontWeight: "500",
		marginTop: 4,
	},
	sectionDivider: {
		height: 1,
		backgroundColor: "#E0E0E0",
		marginLeft: 16,
		marginRight: 16,
		marginTop: 8,
		marginBottom: 12,
	},
	headerSpacer: { flex: 1 },
	dateRow: { flexDirection: "row" },
	modalContainer: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
		justifyContent: "flex-end",
	},
	pastEventsIndicator: {
		backgroundColor: "#FFFBE5",
		padding: 10,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		borderRadius: 8,
		margin: 16,
		marginBottom: 0,
	},
	pastEventsText: { fontSize: 14, color: "#987B30" },
	errorBanner: {
		backgroundColor: "#FDECEA",
		padding: 10,
		borderRadius: 8,
		margin: 16,
		marginBottom: 0,
	},
	errorText: { fontSize: 13, color: "#B3261E" },
	labelIndicator: { width: 5, height: "100%" },
	entryContent: { flex: 1, padding: 12 },
	yearHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 20,
		marginVertical: 16,
	},
	yearLine: { flex: 1, height: 1, backgroundColor: "#C7C7CC" },
	yearText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#3C3C43",
		marginHorizontal: 12,
	},
	eventCountContainer: {
		backgroundColor: "#E9F0FF",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		alignSelf: "flex-start",
		marginTop: 4,
	},
	eventCountText: { fontSize: 12, color: "#007AFF", fontWeight: "500" },
});
