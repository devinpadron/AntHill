import { useState, useEffect } from "react";
import * as ReactNative from "react-native";
import SignUp from "./signup";
import Submission from "./submission";

export default function ClockInApp({ navigation }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clockInTime, setClockInTime] = useState(null);
  const [isVisible, setVisibility] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const unsubscribe = ReactNative.BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackButton
    );

    return () => null;
  }, []);

  const handleBackButton = () => {
    return true;
  };

  {
    /*Padding for Duration*/
  }
  function padTo2Digits(num) {
    return num.toString().padStart(2, "0");
  }

  {
    /*Duration Calculation*/
  }
  function convertMsToTime(milliseconds) {
    if (milliseconds < 0) {
      milliseconds = 0;
    }
    let seconds = Math.floor(milliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    return `${padTo2Digits(hours)}:${padTo2Digits(minutes)}:${padTo2Digits(
      seconds
    )}`;
  }

  const logout = () => {
    navigation.goBack();
  };

  return (
    <ReactNative.View style={styles.container}>
      <ReactNative.Text style={styles.text}>Current Time:</ReactNative.Text>

      {/*Current Time Text*/}
      <ReactNative.Text style={styles.text}>
        {currentTime.toLocaleTimeString()}
      </ReactNative.Text>

      {/*Duration Time Text*/}
      {clockInTime && (
        <ReactNative.Text style={styles.text}>
          You have been clocked in for{" "}
          {convertMsToTime(currentTime - clockInTime)}
        </ReactNative.Text>
      )}

      {isVisible && (
        <ReactNative.TouchableOpacity
          style={[styles.roundButton]}
          onPress={() => {
            navigation.push("Submission");
            setVisibility(false);
          }}
        >
          <ReactNative.Text style={{ color: "white" }}>Submit</ReactNative.Text>
        </ReactNative.TouchableOpacity>
      )}

      {/*Clock In/Out Button*/}
      <ReactNative.TouchableOpacity
        style={[
          styles.clockin,
          {
            backgroundColor: clockInTime ? "#b50b0b" : "#14960e",
            opacity: isVisible ? 0.5 : 1.0,
          },
        ]}
        disabled={isVisible}
        onPress={() => {
          if (clockInTime) {
            setClockInTime(null);
            setVisibility(true);
          } else {
            setClockInTime(new Date());
            setVisibility(false);
          }
        }}
      >
        <ReactNative.Text style={[{ color: "white" }]}>
          {clockInTime ? "Clock Out" : "Clock In"}
        </ReactNative.Text>
      </ReactNative.TouchableOpacity>

      <ReactNative.TouchableOpacity
        style={{
          position: "absolute",
          top: 70,
          right: 30,
        }}
        onPress={logout}
      >
        <ReactNative.Image
          source={require("../assets/exitIcon.png")}
          style={{ height: 40, width: 40 }}
        />
      </ReactNative.TouchableOpacity>
    </ReactNative.View>
  );
}

const styles = ReactNative.StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
  },
  clockin: {
    justifyContent: "center",
    alignItems: "center",
    width: 150,
    marginTop: 150,
    marginBottom: 80,
    height: 150,
    borderRadius: 100,
  },
  roundButton: {
    width: 350,
    height: 100,
    margin: 5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b2c3a",
    borderRadius: 20,
  },
});
