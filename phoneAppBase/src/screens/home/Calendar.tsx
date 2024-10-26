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
} from "../../models/Calendar/agendaItems";
import AgendaItem from "../../models/Calendar/AgendaItem";
import { getTheme, themeColor, lightThemeColor } from "../../themes/theme";
import Constants from "expo-constants";

const today = new Date().toISOString().split("T")[0];
const leftArrowIcon = require("../../../assets/next.png");
const rightArrowIcon = require("../../../assets/next.png");

const ExpandableCalendarScreen = (props: { weekView: any }) => {
  const { weekView } = props;
  const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
  const marked = useRef({});
  const theme = useRef(getTheme());
  const todayBtnTheme = useRef({
    todayButtonTextColor: themeColor,
  });

  useEffect(() => {
    const fetchData = async () => {
      const items = await getAgendaItems();
      setAgendaItems(items);
      marked.current = getMarkedDates(items);
    };
    fetchData();
  }, []);

  const renderItem = useCallback(({ item }: { item: AgendaItemData }) => {
    return <AgendaItem item={item} />;
  }, []);

  return (
    <View style={styles.container}>
      <CalendarProvider date={today} showTodayButton>
        {weekView ? (
          <WeekCalendar firstDay={1} markedDates={marked.current} />
        ) : (
          <ExpandableCalendar
            horizontal
            pagingEnabled
            initialPosition={ExpandableCalendar.positions.OPEN}
            calendarStyle={styles.calendar}
            headerStyle={styles.header}
            theme={theme.current}
            firstDay={1}
            markedDates={marked.current}
            leftArrowImageSource={leftArrowIcon}
            rightArrowImageSource={rightArrowIcon}
            closeOnDayPress={false}
          />
        )}
        <AgendaList
          sections={agendaItems.map((item) => ({
            title: item.date,
            data: item.data,
          }))}
          renderItem={renderItem}
          sectionStyle={styles.section}
        />
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
    justifyContent: "flex-end",
    marginTop: Constants.statusBarHeight,
  },
});
