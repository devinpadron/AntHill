import React, { useRef, useCallback, useState, useEffect } from "react";
import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
import {
	ExpandableCalendar,
	AgendaList,
	CalendarProvider,
	WeekCalendar,
} from "react-native-calendars";
import {
	getAgendaItems,
	getMarkedDates,
	AgendaItemData,
} from "../../controller/agendaItemController";
import AgendaItem from "../../models/Calendar/AgendaItem";
import { getTheme, themeColor, lightThemeColor } from "../../themes/theme";
import moment from "moment";
import LoadingScreen from "../LoadingScreen";
import { SafeAreaView } from "react-native-safe-area-context";

/*
  STILL NEED TO DO:
  - Adjust Today Button spacing
  - Ensure Today Button appears correctly when swiping through months/weeks
*/

/* An ExpanableCalendar that:
  - Allows the user to view their events in a scrollable AgendaList
  - View and select specific dates
  - View dates in a "month view" and "week view"
*/

const today = moment().format("YYYY-MM-DD");
const leftArrowIcon = require("../../assets/previous.png");
const rightArrowIcon = require("../../assets/next.png");

type CalendarProps = {
	weekView?: any;
};

const ExpandableCalendarScreen = ({ weekView }: CalendarProps) => {
	const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
	const [selectedDate, setSelectedDate] = useState(today);
	const [markedDates, setMarkedDates] = useState({});
	const [isLoading, setIsLoading] = useState(false);
	const theme = useRef(getTheme());

	useEffect(() => {
		const fetchData = async () => {
			try {
				setIsLoading(true);
				// HARD CODED COMPANY ID, PLEASE FIX!!!!!
				const items = await getAgendaItems("SoBridalSocial");
				const marks = getMarkedDates(items);

				setAgendaItems(items);
				setMarkedDates(marks);
			} catch (error) {
				console.error("Error fetching agenda items:", error);
			} finally {
				setIsLoading(false);
			}
		};
		fetchData();
	}, []);

	const renderItem = useCallback(({ item }: { item: AgendaItemData }) => {
		return <AgendaItem item={item} />;
	}, []);

	const handleTodayPress = () => {
		setSelectedDate(today);
	};

	useEffect(() => {
		TodayButton;
	}, [selectedDate]);

	const TodayButton = () => {
		if (selectedDate === today) {
			return null;
		}

		return (
			<TouchableOpacity
				style={styles.todayButton}
				onPress={handleTodayPress}
			>
				<Text style={styles.todayButtonText}>Today</Text>
			</TouchableOpacity>
		);
	};
	if (isLoading) {
		return <LoadingScreen />;
	} else {
		return (
			<SafeAreaView style={styles.container}>
				<CalendarProvider date={selectedDate} showTodayButton={true}>
					<View style={styles.calendarContainer}>
						{weekView ? (
							<WeekCalendar
								firstDay={1}
								markedDates={markedDates}
							/>
						) : (
							<>
								<ExpandableCalendar
									horizontal
									pagingEnabled
									initialPosition={
										ExpandableCalendar.positions.OPEN
									}
									calendarStyle={styles.calendar}
									headerStyle={styles.header}
									theme={theme.current}
									firstDay={1}
									markedDates={markedDates}
									leftArrowImageSource={leftArrowIcon}
									rightArrowImageSource={rightArrowIcon}
									closeOnDayPress={false}
									date={selectedDate}
									onDayPress={(day) =>
										setSelectedDate(day.dateString)
									}
								/>
							</>
						)}
					</View>

					<View style={styles.agendaContainer}>
						<AgendaList
							sections={agendaItems.reduce((acc, item) => {
								const existing = acc.find(
									(x) => x.title === item.date
								);
								if (existing) {
									existing.data.push(...item.data);
								} else {
									acc.push({
										title: item.date,
										data: [...item.data],
									});
								}
								return acc;
							}, [] as { title: string; data: any[] }[])}
							renderItem={renderItem}
							sectionStyle={styles.section}
						/>
					</View>
				</CalendarProvider>
			</SafeAreaView>
		);
	}
};

export default ExpandableCalendarScreen;

const styles = StyleSheet.create({
	calendar: {
		paddingLeft: 20,
		paddingRight: 20,
	},
	header: {},
	section: {
		backgroundColor: lightThemeColor,
		color: "grey",
		textTransform: "capitalize",
	},
	container: {
		flex: 1,
	},
	calendarContainer: {
		position: "relative",
	},
	agendaContainer: {
		flex: 1,
	},
	todayButton: {
		position: "absolute",
		bottom: 8,
		right: 28,
		backgroundColor: "white",
		paddingHorizontal: 12,
		paddingVertical: 4,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: themeColor,
		zIndex: 1000,
	},
	todayButtonText: {
		color: themeColor,
		fontSize: 12,
		fontWeight: "600",
	},
});
