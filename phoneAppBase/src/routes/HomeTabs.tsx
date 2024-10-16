import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

// Import your screen components
import Calendar from "../screens/home/Calendar";
import ProfilePage from "../screens/home/ProfilePage";

const Tab = createBottomTabNavigator();

const HomeTabs = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Calendar"
        component={Calendar}
        options={{ headerShown: false}}
      />
      <Tab.Screen
        name="Profile"
        component={ProfilePage}
        options={{ headerShown: false}}
      />
    </Tab.Navigator>
  );
};

export default HomeTabs;
