import { useState } from "react";
import * as ReactNative from "react-native";

export default function SignUp(navigation) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confPassword, setConfPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  return (
    <ReactNative.View style={styles.container}>
      <ReactNative.Image
        style={styles.logoImage}
        source={require("../assets/vicoLogoPrimary.png")}
      />
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="First Name:"
        onChangeText={(newFirstName) => setFirstName(newFirstName)}
        value={firstName}
        autoCorrect={false}
      />
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="Last Name:"
        onChangeText={(newLastName) => setLastName(newLastName)}
        value={lastName}
        autoCorrect={false}
      />
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="Email:"
        onChangeText={(newEmail) => setEmail(newEmail)}
        value={email}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="Phone Number:"
        onChangeText={(newPhoneNumber) => setPhoneNumber(newPhoneNumber)}
        value={phoneNumber}
        keyboardType="number-pad"
      />
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="Password:"
        onChangeText={(newPassword) => setPassword(newPassword)}
        value={password}
        autoCorrect={false}
        autoCapitalize="none"
        secureTextEntry={true}
      />
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="Confirm Password:"
        onChangeText={(newConfPassword) => setConfPassword(newConfPassword)}
        value={confPassword}
        autoCorrect={false}
        autoCapitalize="none"
        secureTextEntry={true}
      />
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="Access Code:"
        onChangeText={(newAccessCode) => setAccessCode(newAccessCode)}
        value={accessCode}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <ReactNative.TouchableOpacity style={styles.roundButton}>
        <ReactNative.Text style={{ color: "white" }}>Sign Up</ReactNative.Text>
      </ReactNative.TouchableOpacity>
    </ReactNative.View>
  );
}

const styles = ReactNative.StyleSheet.create({
  container: {
    flex: 1,
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
