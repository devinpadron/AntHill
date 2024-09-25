import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

// Import your screen components
import Calendar from "../screens/Calendar";
import FormPage from "../screens/FormPage";

const Tab = createBottomTabNavigator();

const HomeTabs = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Calendar"
        component={Calendar}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Tab.Screen
        name="Profile"
        component={FormPage}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Tab.Navigator>
  );
};

export default HomeTabs;
