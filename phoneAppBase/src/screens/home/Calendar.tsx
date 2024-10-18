import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import EventController from '../../controller/eventController';
import AgendaItem from '../../models/Calendar/AgendaItem';

const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [events, setEvents] = useState<FirebaseFirestoreTypes.DocumentData[]>([]);
  const [markedDates, setMarkedDates] = useState({});

  const fetchEvents = useCallback(async (date: string) => {
    try {
      const fetchedEvents = await EventController.getEventsByDate(date);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, []);

  useEffect(() => {
    fetchEvents(selectedDate);
  }, [selectedDate, fetchEvents]);

  useEffect(() => {
    const updateMarkedDates = async () => {
      const marked = {};
      const allDates = await EventController.getEventsByDat // You'll need to implement this method
      allDates.forEach(date => {
        marked[date] = { marked: true };
      });
      setMarkedDates(marked);
    };
    updateMarkedDates();
  }, []);

  const onDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  return (
    <View style={styles.container}>
      <RNCalendar
        onDayPress={onDayPress}
        markedDates={{
          ...markedDates,
          [selectedDate]: { selected: true, marked: markedDates[selectedDate]?.marked }
        }}
      />
      <View style={styles.agendaList}>
        {events.map((event, index) => (
          <AgendaItem key={index} item={event} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  agendaList: {
    flex: 1,
  },
});

export default Calendar;