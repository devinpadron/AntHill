import React, { useRef, useCallback, useState, useEffect } from "react";
import {
	StyleSheet,
	View,
	Platform,
	TouchableOpacity,
	Text,
} from "react-native";
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
import Constants from "expo-constants";

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

const today = new Date().toISOString().split("T")[0];
const leftArrowIcon = require("../../../assets/next.png");
const rightArrowIcon = require("../../../assets/next.png");

type CalendarProps = {
	weekView?: any;
};

const ExpandableCalendarScreen = ({ weekView }: CalendarProps) => {
	const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
	const [selectedDate, setSelectedDate] = useState(today);
	const marked = useRef({});
	const theme = useRef(getTheme());

	useEffect(() => {
		const fetchData = async () => {
			//HARD CODED COMPANY. PLEASE REPLACE!!!!
			const items = await getAgendaItems("SoBridalSocial");
			setAgendaItems(items);
			marked.current = getMarkedDates(items);
		};
		fetchData();
	}, []);

	const renderItem = useCallback(({ item }: { item: AgendaItemData }) => {
		return <AgendaItem item={item} />;
	}, []);

	const handleTodayPress = () => {
		setSelectedDate(today);
	};

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

	return (
		<View style={styles.container}>
			<CalendarProvider date={selectedDate} showTodayButton={false}>
				<View style={styles.calendarContainer}>
					{weekView ? (
						<WeekCalendar
							firstDay={1}
							markedDates={marked.current}
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
								markedDates={marked.current}
								leftArrowImageSource={leftArrowIcon}
								rightArrowImageSource={rightArrowIcon}
								closeOnDayPress={false}
								date={selectedDate}
								onDayPress={(day) =>
									setSelectedDate(day.dateString)
								}
							/>
							<TodayButton />
						</>
					)}
				</View>

				<View style={styles.agendaContainer}>
					<AgendaList
						sections={agendaItems.map((item) => ({
							title: item.date,
							data: item.data,
						}))}
						renderItem={renderItem}
						sectionStyle={styles.section}
					/>
				</View>
			</CalendarProvider>
		</View>
	);
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
		marginTop: Constants.statusBarHeight,
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
