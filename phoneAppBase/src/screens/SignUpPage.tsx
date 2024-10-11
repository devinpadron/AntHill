import React, { useState } from "react";
import {
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";

export default function SignUpPage(navigation) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confPassword, setConfPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.textInput}
        placeholder="First Name:"
        onChangeText={(newFirstName) => setFirstName(newFirstName)}
        value={firstName}
        autoCorrect={false}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Last Name:"
        onChangeText={(newLastName) => setLastName(newLastName)}
        value={lastName}
        autoCorrect={false}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Email:"
        onChangeText={(newEmail) => setEmail(newEmail)}
        value={email}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.textInput}
        placeholder="Password:"
        onChangeText={(newPassword) => setPassword(newPassword)}
        value={password}
        autoCorrect={false}
        autoCapitalize="none"
        secureTextEntry={true}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Confirm Password:"
        onChangeText={(newConfPassword) => setConfPassword(newConfPassword)}
        value={confPassword}
        autoCorrect={false}
        autoCapitalize="none"
        secureTextEntry={true}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Company Code:"
        onChangeText={(newAccessCode) => setAccessCode(newAccessCode)}
        value={accessCode}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.roundButton}>
        <Text style={{ color: "white" }}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    //justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    width: 350,
    height: 40,
    color: "black",
    margin: 10,
    padding: 5,
    fontSize: 16,
    borderColor: "rgba(211,211,211,0.5)",
    borderWidth: 1,
    borderRadius: 5,
  },
  logoImage: {
    width: 350,
    height: 200,
    marginTop: 100,
    marginBottom: -25,
  },
  roundButton: {
    width: 350,
    margin: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b2c3a",
    borderRadius: 20,
    height: 30,
  },
});
