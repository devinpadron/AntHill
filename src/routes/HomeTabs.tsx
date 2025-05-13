import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import CalendarStack from "./CalendarStack";
import SettingStack from "./SettingStack";
import ClockStack from "./ClockStack";

const Tab = createBottomTabNavigator();

const HomeTabs = () => {
	return (
		<Tab.Navigator
			screenOptions={{
				tabBarShowLabel: false, // Hide the labels
				tabBarStyle: {
					paddingVertical: 5, // Optional: add some padding
				},
			}}
		>
			<Tab.Screen
				name="Calendar"
				component={CalendarStack}
				options={{
					headerShown: false,
					tabBarIcon: ({ focused, color, size }) => (
						<Ionicons
							name={focused ? "calendar" : "calendar-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tab.Screen
				name="Clock"
				component={ClockStack}
				options={{
					headerShown: false,
					tabBarIcon: ({ focused, color, size }) => (
						<Ionicons
							name={focused ? "time" : "time-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
			<Tab.Screen
				name="Settings"
				component={SettingStack}
				options={{
					headerShown: false,
					unmountOnBlur: true,
					tabBarIcon: ({ focused, color, size }) => (
						<Ionicons
							name={focused ? "settings" : "settings-outline"}
							size={size}
							color={color}
						/>
					),
				}}
			/>
		</Tab.Navigator>
	);
};

export default HomeTabs;
