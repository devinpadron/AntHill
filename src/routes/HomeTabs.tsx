import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import CalendarStack from "./CalendarStack";
import SettingStack from "./SettingStack";

const Tab = createBottomTabNavigator();

const HomeTabs = () => {
	return (
		<Tab.Navigator>
			<Tab.Screen
				name="Calendar"
				component={CalendarStack}
				options={{ headerShown: false }}
			/>
			<Tab.Screen
				name="Settings"
				component={SettingStack}
				options={{ headerShown: false }}
			/>
		</Tab.Navigator>
	);
};

export default HomeTabs;
