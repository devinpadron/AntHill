import React, { useState } from "react";
import {
  View,
  Image,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
} from "react-native";
import UserController from "../../data/controller/userController";
import User from "../../data/class/userClass";
import { useAuth } from "../../auth/AuthProvider";


const SignUpPage = ({navigation}) => {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confPassword, setConfPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");

  //add error checking later
  const createAndAddNewUser = async () => {
    const newUser = new User;
    newUser.setFirstName(firstName);
    newUser.setLastName(lastName);
    newUser.setEmail(email);
    newUser.setPrivilege("user");
    await UserController.addUser(newUser);
  };

  const validateFields = () => {
    if (!firstName.trim()) {
      return "First name is required.";
    }
    if (!lastName.trim()) {
      return "Last name is required.";
    }
    if (!email.trim()) {
      return "Email is required.";
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return "Email is invalid.";
    }
    if (!password) {
      return "Password is required.";
    }
    if (password.length < 6) {
      return "Password must be at least 6 characters long.";
    }
    if (password !== confPassword) {
      return "Passwords do not match.";
    }
    // Add any other validation rules here (e.g., for accessCode if it's required)
    return null; // No errors
  };

  const handleSignUp = async () => {
    try {
      const validationError = validateFields();
      if (validationError) {
        throw new Error(validationError);
      }

      await signUp(email, password);

      await createAndAddNewUser();

      Alert.alert("Success", "Account Created Successfully", [
        { text: "OK", onPress: () => navigation.navigate("Login") }
      ]);
      
    } catch (error) {
      let errorMessage = "An unexpected error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      Alert.alert("Sign Up Failed", errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.textInput}
        placeholder="First Name:"
        onChangeText={setFirstName}
        value={firstName}
        autoCorrect={false}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Last Name:"
        onChangeText={setLastName}
        value={lastName}
        autoCorrect={false}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Email:"
        onChangeText={setEmail}
        value={email}
        autoCorrect={false}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.textInput}
        placeholder="Password:"
        onChangeText={setPassword}
        value={password}
        autoCorrect={false}
        autoCapitalize="none"
        secureTextEntry={true}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Confirm Password:"
        onChangeText={setConfPassword}
        value={confPassword}
        autoCorrect={false}
        autoCapitalize="none"
        secureTextEntry={true}
      />
      <TextInput
        style={styles.textInput}
        placeholder="Company Code:"
        onChangeText={setAccessCode}
        value={accessCode}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.roundButton} onPress={handleSignUp}>
        <Text style={{ color: "white" }}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

export default SignUpPage

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
