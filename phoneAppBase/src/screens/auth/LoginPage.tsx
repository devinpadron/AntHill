import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

import { useAuth } from "../../auth/AuthProvider";

//import { genSalt } from "bcryptjs";

const LoginPage = ({ navigation }) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    try {
      await signIn(email, password);

    }catch (error) {
      let errorMessage = "An unexpected error occured";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      Alert.alert("Login Failed", errorMessage);
    }
  };
  

  const handleSignup = () => {
    navigation.navigate("Sign Up");
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image
        style={styles.logoImage}
        source={require("../../../assets/DolceNGelato/vicoLogoPrimary.png")}
      />

      {/* Username Textbox */}
      <TextInput
        style={[styles.textInput, { marginTop: -20 }]}
        placeholder="Email:"
        onChangeText={setEmail}
        value={email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />

      <TextInput
        style={styles.textInput}
        placeholder="Password:"
        onChangeText={setPassword}
        secureTextEntry={true}
        value={password}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.roundButton, { height: 45, marginTop: 40 }]}
        onPress={handleLogin}
      >
        <Text style={[styles.buttonText, { color: "white" }]}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.roundButton, { height: 35 }]}
        onPress={handleSignup}
      >
        <Text style={[styles.buttonText, { color: "white" }]}>Signup</Text>
      </TouchableOpacity>

      <TouchableOpacity>
        <Text style={[{ color: "blue", marginTop: 15 }]}>Forgot Password</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </View>
  );
};

export default LoginPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    alignItems: "center",
    //justifyContent: 'center',
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
    width: 450,
    height: 300,
    marginTop: 120,
  },
  roundButton: {
    width: 350,
    margin: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b2c3a",
    borderRadius: 20,
  },
  buttonText: {
    fontSize: 20,
  },
});