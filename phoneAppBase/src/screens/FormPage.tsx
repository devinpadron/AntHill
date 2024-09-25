import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Button,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";

const FormPage: React.FC = () => {
  const [name, setName] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [location, setLocation] = useState("");
  const [hours, setHours] = useState("");
  const [worker, setWorker] = useState("");
  const [notes, setNotes] = useState("");
  const [document, setDocument] =
    useState<DocumentPicker.DocumentResult | null>(null);

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setDate(selectedDate);
  };

  const handleDocumentUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (result.type === "success") {
      setDocument(result);
    } else {
      Alert.alert("Document upload canceled");
    }
  };

  const handleSubmit = () => {
    // Handle the form submission
    Alert.alert(
      "Form Submitted",
      `Name: ${name}\nDate: ${date?.toDateString()}\nLocation: ${location}\nHours: ${hours}\nWorker: ${worker}\nNotes: ${notes}\nDocument: ${
        document?.name
      }`
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter name"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Date</Text>
      <DateTimePicker
        value={date || new Date()}
        mode="date"
        display="default"
        onChange={handleDateChange}
      />

      <Text style={styles.label}>Location</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter location"
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>Amount of Hours</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter amount of hours"
        value={hours}
        onChangeText={setHours}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Assigned Worker</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter assigned worker"
        value={worker}
        onChangeText={setWorker}
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Enter notes"
        value={notes}
        onChangeText={setNotes}
        multiline={true}
      />

      <TouchableOpacity
        style={styles.uploadButton}
        onPress={handleDocumentUpload}
      >
        <Text style={styles.uploadButtonText}>
          {document ? "Document: ${document.name}" : "Upload Document"}
        </Text>
      </TouchableOpacity>

      <Button title="Submit" onPress={handleSubmit} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 50,
    paddingTop: 50,
  },
  label: {
    fontSize: 16,
    marginVertical: 8,
  },
  input: {
    height: 40,
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  notesInput: {
    height: 100,
  },
  uploadButton: {
    backgroundColor: "#6200EE",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginVertical: 10,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
  },
});

export default FormPage;
