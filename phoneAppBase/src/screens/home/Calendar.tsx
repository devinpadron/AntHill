import React, { useRef, useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  ExpandableCalendar,
  AgendaList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";
import { agendaItems, getMarkedDates, today } from "../../models/Calendar/agendaItems";
import AgendaItem from "../../models/Calendar/AgendaItem";
import { getTheme, themeColor, lightThemeColor } from "../../themes/theme";
import Constants from "expo-constants";

const leftArrowIcon = require("../../../assets/next.png");
const rightArrowIcon = require("../../../assets/next.png");
const ITEMS: any[] = agendaItems;

interface Props {
  weekView?: boolean;
}

const ExpandableCalendarScreen = (props: Props) => {
  //CALENDER
  const { weekView } = props;
  const marked = useRef(getMarkedDates());
  const theme = useRef(getTheme());
  const todayBtnTheme = useRef({
    todayButtonTextColor: themeColor,
  });

  const renderItem = useCallback(({ item }: any) => {
    return <AgendaItem item={item} />;
  }, []);

  return (
    <View style={styles.container}>
      <CalendarProvider
        date={today}
        // onDateChanged={onDateChanged}
        // onMonthChange={onMonthChange}
        showTodayButton
        // disabledOpacity={0.6}
        //theme={todayBtnTheme.current}
        // todayBottomMargin={16}
      >
        {weekView ? (
          <WeekCalendar
            //testID={testIDs.weekCalendar.CONTAINER}
            firstDay={1}
            markedDates={marked.current}
          />
        ) : (
          <ExpandableCalendar
            horizontal={true}
            pagingEnabled={true}
            // hideArrows
            // disablePan
            // hideKnob
            initialPosition={ExpandableCalendar.positions.OPEN}
            calendarStyle={styles.calendar}
            headerStyle={styles.header} // for horizontal only
            //disableWeekScroll
            theme={theme.current}
            //disableAllTouchEventsForDisabledDays={true}
            firstDay={1}
            markedDates={marked.current}
            leftArrowImageSource={leftArrowIcon}
            rightArrowImageSource={rightArrowIcon}
            // animateScroll
            closeOnDayPress={false}
          />
        )}
        <AgendaList
          sections={ITEMS}
          renderItem={renderItem}
          // scrollToNextEvent
          sectionStyle={styles.section}
          // dayFormat={'yyyy-MM-d'}
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
