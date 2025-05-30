import React, { useCallback, useMemo, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	FlatList,
	StatusBar,
	RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../../contexts/UserContext";
import moment from "moment";
import { usePullEvents } from "../../hooks/usePullEvents";
import { FilterType } from "../../types";
import { CalendarList } from "react-native-calendars";
import { Dimensions } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import LoadingScreen from "../../screens/LoadingScreen";

export default function Timesheet(
	props: {
		filterType: FilterType;
		selectedUsers: string[];
		showAllSelectedOnly: boolean;
		showExactSelectedOnly: boolean;
		navigation: any;
		onCalOpen: () => void;
		onCalClose: () => void;
		selectedDate: string;
		setSelectedDate: (date: string) => void;
		locked?: boolean;
	} = {
		filterType: FilterType.MY,
		selectedUsers: [],
		showAllSelectedOnly: false,
		showExactSelectedOnly: false,
		navigation: null,
		onCalOpen: () => {},
		onCalClose: () => {},
		selectedDate: null,
		setSelectedDate: () => {},
		locked: false,
	},
) {
	const { userId, companyId, user } = useUser();
	const {
		agendaItems,
		markedDates,
		includePastEvents,
		loadPastEvents,
		togglePastEvents,
		isLoading,
	} = usePullEvents(
		companyId,
		userId,
		props.filterType,
		props.selectedUsers,
		props.showAllSelectedOnly,
		props.showExactSelectedOnly,
		props.selectedDate,
	);

	const [refreshing, setRefreshing] = useState(false);
	const onRefresh = useCallback(() => {
		setRefreshing(true);

		// Load past events
		loadPastEvents();

		setRefreshing(false);
	}, [loadPastEvents]);

	const timesheetData = useMemo(() => {
		const formattedEntries = [];
		const today = moment().startOf("day");

		// Get all dates from agendaItems and sort them
		const sortedDates = Object.keys(agendaItems).sort((a, b) =>
			moment(a).diff(moment(b)),
		);

		// Process each date
		sortedDates.forEach((dateString) => {
			const events = agendaItems[dateString] || [];
			if (events.length === 0) return;

			const entries = events.map((event) => {
				// Calculate hours from duration or time difference
				let hours = 0;
				let description = "";
				if (event.duration) {
					hours = parseFloat(event.duration);
				} else {
					hours = 0; // Default for all-day events
				}

				if (event.startTime) {
					const startTime = moment(
						event.startTime,
						"YYYY-MM-DD HH:mm",
					);
					description = startTime.format("h:mm A");
				}

				return {
					id: event.uid,
					title: event.title,
					hours: parseFloat(hours.toFixed(1)),
					description: description,
					date: dateString,
				};
			});

			// Format the date display
			let displayDate;
			const momentDate = moment(dateString);

			if (momentDate.isSame(today, "day")) {
				displayDate = "Today";
			} else {
				displayDate = momentDate.format("MMMM D, YYYY");
			}

			formattedEntries.push({
				date: displayDate,
				entries: entries,
			});
		});

		return formattedEntries;
	}, [agendaItems]);

	const renderSectionHeader = ({ date }) => {
		const dateObj =
			date === "Today" ? moment() : moment(date, "MMMM D, YYYY");

		const dayNumber = dateObj.format("D");
		const dayName = dateObj.format("ddd");
		const monthName = dateObj.format("MMM");

		return (
			<View
				style={[
					styles.sectionHeader,
					moment(dateObj).isBefore(moment().startOf("day")) && {
						opacity: 0.5,
					},
				]}
			>
				<View style={styles.dateNumberContainer}>
					<View style={styles.dateTextContainer}>
						<Text style={styles.dateMonth}>{monthName}</Text>
					</View>
					<Text style={styles.dateNumber}>{dayNumber}</Text>
					<View style={styles.dateTextContainer}>
						<Text style={styles.dateDay}>{dayName}</Text>
					</View>
				</View>

				{/* Add a spacer here to ensure proper alignment */}
				<View style={styles.headerSpacer} />
			</View>
		);
	};

	// Render timesheet entry
	const renderEntry = (entry) => {
		const pushDetails = () => {
			props.navigation.navigate("Details", {
				eventId: entry.id,
			});
		};

		return (
			<TouchableOpacity onPress={pushDetails}>
				<View
					style={[
						styles.entryCard,
						moment(entry.date).isBefore(
							moment().startOf("day"),
						) && {
							opacity: 0.5,
						},
					]}
				>
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
			</TouchableOpacity>
		);
	};

	const [calIsOpen, setCalIsOpen] = useState(false);
	const [calIndex, setCalIndex] = useState(-1);
	const toggleCalendar = (set?: number) => {
		if (props.locked) {
			return;
		}
		if (calIsOpen || set === 0) {
			setCalIsOpen(false);
			setCalIndex(-1);
			props.onCalClose();
		} else {
			setCalIndex(1);
			setCalIsOpen(true);
			props.onCalOpen();
		}
	};

	const CalendarModal = () => {
		return (
			<BottomSheet
				snapPoints={["50%", "90%"]}
				enablePanDownToClose={true}
				index={calIndex}
				onClose={() => toggleCalendar(0)}
			>
				<BottomSheetView style={styles.modalContainer}>
					<CalendarList
						markedDates={markedDates}
						date={props.selectedDate}
						pastScrollRange={50}
						futureScrollRange={50}
						scrollEnabled={true}
						onDayPress={(day) => {
							// Handle day selection here if needed
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
		);
	};

	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<View style={styles.container}>
			<StatusBar barStyle="dark-content" />

			{/* Header */}
			<View style={styles.header}>
				<Text style={styles.headerTitle}>
					{user.firstName.substr(user.firstName.length - 1) == "s"
						? user.firstName + "' Schedule"
						: user.firstName + "'s Schedule"}
				</Text>
				<TouchableOpacity
					style={styles.headerButton}
					onPress={() => toggleCalendar()}
				>
					<Ionicons name="calendar" size={24} color="#007AFF" />
				</TouchableOpacity>
			</View>
			{includePastEvents && (
				<View style={styles.pastEventsIndicator}>
					<Text style={styles.pastEventsText}>
						Showing past events
					</Text>
					<TouchableOpacity
						onPress={() => togglePastEvents()}
						style={styles.resetButton}
					>
						<Text style={styles.resetButtonText}>Reset</Text>
					</TouchableOpacity>
				</View>
			)}
			{timesheetData.length === 0 && (
				<View style={styles.pastEventsIndicator}>
					<Text style={styles.pastEventsText}>
						No scheduled events
					</Text>
				</View>
			)}
			<FlatList
				data={timesheetData}
				refreshControl={
					props.selectedDate === null ? (
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
							title={
								includePastEvents
									? "Including past events"
									: "Pull to see past events"
							}
							tintColor="#007AFF"
						/>
					) : null
				}
				keyExtractor={(item) => item.date}
				renderItem={({ item }) => (
					<View style={styles.section}>
						<View style={styles.dateRow}>
							{renderSectionHeader(item)}

							<View style={styles.entriesContainer}>
								{item.entries.map((entry) => (
									<View key={entry.id}>
										{renderEntry(entry)}
									</View>
								))}
							</View>
						</View>

						{/* Divider line still appears after all entries */}
						<View style={styles.sectionDivider} />
					</View>
				)}
				contentContainerStyle={styles.listContent}
			/>

			<CalendarModal />
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#F7F7F9",
	},
	weekSelector: {
		flexDirection: "row",
		justifyContent: "space-around",
		paddingVertical: 10,
		backgroundColor: "white",
	},
	weekDay: {
		alignItems: "center",
	},
	weekDayText: {
		fontSize: 14,
		color: "#8E8E93",
		marginBottom: 5,
	},
	weekDateCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: "center",
		justifyContent: "center",
	},
	weekDateCircleActive: {
		backgroundColor: "#007AFF",
	},
	weekDateText: {
		fontSize: 16,
		fontWeight: "500",
		color: "#333",
	},
	weekDateTextActive: {
		color: "white",
	},
	divider: {
		height: 1,
		backgroundColor: "#E0E0E0",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#F7F7F9",
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: "bold",
		color: "#333",
	},
	headerButton: {
		padding: 8,
	},
	summaryCard: {
		margin: 16,
		padding: 16,
		backgroundColor: "white",
		borderRadius: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 3,
		elevation: 2,
	},
	listContent: {
		paddingBottom: 20,
	},
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	summaryLabel: {
		fontSize: 16,
		color: "#666",
	},
	summaryValue: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#333",
	},
	section: {
		marginVertical: 4,
	},
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
		padding: 12,
		marginBottom: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
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
	dateTextContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	dateDay: {
		fontSize: 14,
		color: "#666",
		marginRight: 4,
	},
	dateMonth: {
		fontSize: 14,
		color: "#666",
		fontWeight: "500",
	},
	sectionLine: {
		flex: 1,
		height: 1,
		backgroundColor: "#E0E0E0",
		marginLeft: 10,
	},
	projectName: {
		fontSize: 16,
		fontWeight: "500",
		color: "#333",
		marginBottom: 0,
	},
	allDayText: {
		fontSize: 14,
		color: "#666",
		fontStyle: "italic",
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
	headerSpacer: {
		flex: 1,
	},
	dateRow: {
		flexDirection: "row",
	},
	modalContainer: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
		justifyContent: "flex-end",
	},
	calendarContainer: {
		backgroundColor: "white",
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		height: Dimensions.get("window").height * 0.9, // 80% of screen height
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: -3,
		},
		shadowOpacity: 0.27,
		shadowRadius: 4.65,
		elevation: 6,
	},
	calendarHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	calendarTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	closeButton: {
		padding: 4,
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
	pastEventsText: {
		fontSize: 14,
		color: "#987B30",
	},
	resetButton: {
		backgroundColor: "#F0E7C2",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 4,
	},
	resetButtonText: {
		fontSize: 14,
		color: "#987B30",
		fontWeight: "500",
	},
});
