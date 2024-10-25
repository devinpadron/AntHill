import React, { useRef, useCallback, useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import {
  ExpandableCalendar,
  AgendaList,
  CalendarProvider,
  WeekCalendar,
} from "react-native-calendars";
import AgendaItem, { AgendaItemData, getAgendaItems } from "../../models/Calendar/AgendaItem";
import { getTheme, themeColor, lightThemeColor } from "../../themes/theme";
import Constants from "expo-constants";

const leftArrowIcon = require("../../../assets/next.png");
const rightArrowIcon = require("../../../assets/next.png");
const today = new Date().toISOString().split("T")[0];

interface Props {
  weekView?: boolean;
}

const ExpandableCalendarScreen: React.FC<Props> = ({ weekView }) => {
  const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const theme = useRef(getTheme());
  const todayBtnTheme = useRef({
    todayButtonTextColor: themeColor,
  });

  useEffect(() => {
    fetchAgendaItems(selectedDate);
  }, [selectedDate]);

  const fetchAgendaItems = async (date: string) => {
    setLoading(true);
    try {
      const items = await getAgendaItems(date);
      setAgendaItems(items);
    } catch (error) {
      console.error("Error fetching agenda items:", error);
      setAgendaItems([]);
    } finally {
      setLoading(false);
    }
  };

  const onDateChanged = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const renderItem = useCallback(({ item }: { item: AgendaItemData }) => {
    return <AgendaItem item={item} />;
  }, []);

  const marked = useRef({
    [selectedDate]: { marked: true, dotColor: themeColor }
  });

  const renderSectionHeader = () => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionHeader}>{selectedDate}</Text>
      {selectedDate !== today && (
        <TouchableOpacity 
          style={styles.todayButton}
          onPress={() => onDateChanged(today)}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.contentContainer}>
          {renderSectionHeader()}
          <View style={styles.noEventsContainer}>
          </View>
        </View>
      );
    }

    if (agendaItems.length === 0) {
      return (
        <View style={styles.contentContainer}>
          {renderSectionHeader()}
          <View style={styles.noEventsContainer}>
            <Text style={styles.noEventsText}>No events planned for this date</Text>
          </View>
        </View>
      );
    }

    return (
      <AgendaList
        sections={[{ 
          title: selectedDate,
          data: agendaItems,
        }]}
        renderItem={renderItem}
        sectionStyle={styles.section}
        renderSectionHeader={renderSectionHeader}
      />
    );
  };

  return (
    <View style={styles.container}>
      <CalendarProvider
        date={selectedDate}
        onDateChanged={onDateChanged}
        showTodayButton={false}
        theme={todayBtnTheme.current}
      >
        {weekView ? (
          <WeekCalendar
            firstDay={1}
            markedDates={marked.current}
          />
        ) : (
          <ExpandableCalendar
            horizontal={true}
            pagingEnabled={true}
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
        {renderContent()}
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
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lightThemeColor,
    padding: 10,
  },
  sectionHeader: {
    color: 'black',
    fontSize: 14,
    fontWeight: 'bold',
  },
  todayButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: themeColor,
    borderRadius: 20,
  },
  todayButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    justifyContent: "flex-end",
    marginTop: Constants.statusBarHeight,
  },
  contentContainer: {
    flex: 1,
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noEventsText: {
    fontSize: 16,
    color: 'gray',
  },
});