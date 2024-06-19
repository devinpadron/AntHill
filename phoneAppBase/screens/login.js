import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import * as ReactNative from "react-native";
import { genSalt } from "bcryptjs";

var bcrypt = require("bcryptjs");

export default function Login({ navigation }) {
  const login = () => {
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
    navigation.push("Home");
    setUname("");
    setPass("");
  };

  const signup = () => {
    navigation.push("SignUp");
  };
  const [uname, setUname] = useState("");
  const [pass, setPass] = useState("");

  return (
    <ReactNative.View style={styles.container}>
      {/* Logo */}
      <ReactNative.Image
        style={styles.logoImage}
        source={require("../assets/vicoLogoPrimary.png")}
      />

      {/* Username Textbox */}
      <ReactNative.TextInput
        style={[styles.textInput, { marginTop: -20 }]}
        placeholder="Username:"
        onChangeText={(newUname) => setUname(newUname)}
        value={uname}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Password Textbox */}
      <ReactNative.TextInput
        style={styles.textInput}
        placeholder="Password:"
        onChangeText={(newPass) => setPass(newPass)}
        secureTextEntry={true}
        value={pass}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Login Button */}
      <ReactNative.TouchableOpacity
        style={[styles.roundButton, { height: 45, marginTop: 40 }]}
        onPress={login}
      >
        <ReactNative.Text style={[styles.buttonText, { color: "white" }]}>
          Login
        </ReactNative.Text>
      </ReactNative.TouchableOpacity>

      {/* Signup Button */}
      <ReactNative.TouchableOpacity
        style={[styles.roundButton, { height: 35 }]}
        onPress={signup}
      >
        <ReactNative.Text style={[styles.buttonText, { color: "white" }]}>
          Signup
        </ReactNative.Text>
      </ReactNative.TouchableOpacity>

      {/* Forgot Password Button */}
      <ReactNative.TouchableOpacity>
        <ReactNative.Text style={[{ color: "blue", marginTop: 15 }]}>
          Forgot Password
        </ReactNative.Text>
      </ReactNative.TouchableOpacity>

      <StatusBar style="auto" />
    </ReactNative.View>
  );
}

const styles = ReactNative.StyleSheet.create({
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
