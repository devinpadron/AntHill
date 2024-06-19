import { createStackNavigator } from "@react-navigation/stack";

// Pages
import Home from "../screens/home";
// import Login from "../screens/login";
// import SignUp from "../screens/signup";
// import Submission from "../screens/submission";

const Stack = createStackNavigator();
function StackScreen() {
  return (
    <Stack.Navigator>
      {/* <Stack.Screen
        name="Login"
        component={Login}
        options={{ headerShown: false, gestureEnabled: false }}
      /> */}
      <Stack.Screen
        name="Home"
        component={Home}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      {/* <Stack.Screen
        name="SignUp"
        component={SignUp}
        options={{ headerShown: false, gestureEnabled: true }}
      /> */}
      {/* <Stack.Screen
        name="Submission"
        component={Submission}
        options={{ headerShown: false }}
      /> */}
    </Stack.Navigator>
  );
}

export default function FlowNavigator() {
  return <StackScreen />;
}
