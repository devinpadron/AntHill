import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import DatePicker from 'react-native-date-picker'
import { Ionicons } from '@expo/vector-icons';
import moment from "moment";
import DropDownPicker from 'react-native-dropdown-picker';

const EventSubmit = () => {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date());
  const [worker, setWorker] = useState([]);
  const [notes, setNotes] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [openSelect, setOpenSelect] = useState(false);
  const [openDate, setOpenDate] = useState(false);

  const [items, setItems] = useState([
    {label: 'Devin', value:'devin'},
    {label: 'Bakos', value:'bakos'},
    {label: 'Billy', value:'billy'}
  ]);

  const handleSubmit = () => {
    // Handle the form submission
    console.log('Form submitted');
  };

  const formatDate = (date: Date) => {
    if (allDay){
      return moment(date).format('dddd, MMMM Do YYYY');
    }
    else{
      return moment(date).format('dddd, MMMM Do YYYY, h:mm a');
    }
  };

  const checkDateOpen = () => {
    setOpenDate(!openDate)
    if (openSelect){
      setOpenSelect(false)
    }
  };

  const checkSelectOpen = () => {
    setOpenSelect(!openSelect)
    if (openDate){
      setOpenDate(false)
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.heading}>Submit New Event</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Title"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity onPress={checkDateOpen} style={styles.dateButton}>
            <Text style={styles.dateButtonText}>{formatDate(date)}</Text>
          </TouchableOpacity>
          <DatePicker
            modal
            open={openDate}
            date={date}
            onConfirm={(date) => {
              setOpenDate(false)
              setDate(date)
            }}
            onCancel={() => {
              setOpenDate(false)
            }}
            mode={allDay ? "date" : "datetime"}
          />
        </View>

        <View style={styles.switchContainer}>
          <Text style={styles.label}>All Day</Text>
          <Switch
            value={allDay}
            onValueChange={(value) => {
              setAllDay(value);
              if (value) {
                // If switching to all-day, reset the time to midnight
                const newDate = new Date(date);
                newDate.setHours(0, 0, 0, 0);
                setDate(newDate);
              }
            }}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={allDay ? "#f5dd4b" : "#f4f3f4"}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Assigned Worker</Text>
          <DropDownPicker
            multiple={true}
            min={0}
            max={5}
            value={worker}
            setValue={setWorker}
            items={items}
            open={openSelect}
            setOpen={checkSelectOpen}
            mode={'BADGE'}
            listMode='SCROLLVIEW'
            searchable={true}/>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Enter notes"
            value={notes}
            onChangeText={setNotes}
            multiline={true}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit</Text>
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
    fontWeight: '600',
  },
  input: {
    height: 50,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: 'white',
  },
  notesInput: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: "#007AFF",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
});

export default EventSubmit;