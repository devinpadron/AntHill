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

import { useUser } from "../../data/context/UserContext";

//import { genSalt } from "bcryptjs";

const LoginPage = ({ navigation }) => {
  const { login } = useUser();
  //Check if user exists in database
  // ----
  // 
  //Check if password is correct
  // hashPass = Password from database
  // bcrypt.compare(pass, hashPass, function (err, result) {
  //   if (err != null) {
  //     print(err);
  //     //Throw a notification for this error
  //   }
  //   if (result == true) {
  //     navigation.push("Home");
  //   } else if (result == false) {
  //     //Throw a notification explaining why
  //   }
  // });

  const signup = () => {
    navigation.navigate("Sign Up");
  };
  const handleLogin = async () => {
    login();
  };
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");

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
        placeholder="Username:"
        onChangeText={(newUname) => setUname(newUname)}
        value={uname}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Password Textbox */}
      <TextInput
        style={styles.textInput}
        placeholder="Password:"
        onChangeText={(newPass) => setPass(newPass)}
        secureTextEntry={true}
        value={pass}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Login Button */}
      <TouchableOpacity
        style={[styles.roundButton, { height: 45, marginTop: 40 }]}
        onPress={handleLogin}
      >
        <Text style={[styles.buttonText, { color: "white" }]}>Login</Text>
      </TouchableOpacity>

      {/* Signup Button */}
      <TouchableOpacity
        style={[styles.roundButton, { height: 35 }]}
        onPress={signup}
      >
        <Text style={[styles.buttonText, { color: "white" }]}>Signup</Text>
      </TouchableOpacity>

      {/* Forgot Password Button */}
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