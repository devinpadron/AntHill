import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

// Import your screen components
import Calendar from "../screens/home/Calendar";
import SettingStack from "./SettingStack";

const Tab = createBottomTabNavigator();

const HomeTabs = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Calendar"
        component={Calendar}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingStack}
        options={{ headerShown: false, unmountOnBlur: true }}
      />
    </Tab.Navigator>
  );
};

export default HomeTabs;
