import React, { useRef, useCallback, useState, useEffect } from "react";
import { StyleSheet, View } from "react-native";
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
} from "./components/agendaItemController";
import AgendaItem from "./components/AgendaItem";
import { getTheme, themeColor, lightThemeColor } from "./theme";
import moment from "moment";
import LoadingScreen from "../../LoadingScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import { subscribeCurrentUser } from "../../../controllers/userController";

/* An ExpanableCalendar that:
  - Allows the user to view their events in a scrollable AgendaList
  - View and select specific dates
  - View dates in a "month view" and "week view"
*/

const today = moment().format("YYYY-MM-DD");
const leftArrowIcon = require("../../../assets/previous.png");
const rightArrowIcon = require("../../../assets/next.png");

type CalendarProps = {
	weekView?: any;
};

const ExpandableCalendarScreen = ({ weekView }: CalendarProps) => {
	const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
	const [selectedDate, setSelectedDate] = useState(today);
	const [markedDates, setMarkedDates] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState(null);
	const theme = useRef(getTheme());

	//TODO: This subsciption will be updated later to check for changes to assigned events rather than user data
	useEffect(() => {
		const subscriber = subscribeCurrentUser(async (user) => {
			try {
				const userData = user.data();
				if (!userData) return;
				setUser(userData);
				const items = await getAgendaItems(userData.loggedInCompany);
				const marks = getMarkedDates(items);
				setAgendaItems(items);
				setMarkedDates(marks);
			} catch (error) {
				console.error(error);
			}
		});
		return () => subscriber();
	}, []);

	useEffect(() => {
		if (user) {
			setIsLoading(false);
		}
	}, [user]);

	const renderItem = useCallback(({ item }: { item: AgendaItemData }) => {
		return <AgendaItem item={item} />;
	}, []);

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
