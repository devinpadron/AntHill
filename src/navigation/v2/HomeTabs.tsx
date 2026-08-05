import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import CalendarStack from "./CalendarStack";
import SettingStack from "./SettingStack";
import ClockStack from "./ClockStack";
import AvailabilityStack from "./AvailabilityStack";
import { useCompany } from "../../contexts/v2/CompanyContext";

/*
 * The bottom tabs, mirroring production.
 *
 * Availability and Clock are feature-flagged off company preferences, so a
 * tab's very existence depends on company config — same as v1.
 *
 * Preferences are a LIVE subscription in v2, so toggling a feature flag now
 * adds or removes a tab without an app relaunch. Under v1 it did not.
 */

const Tab = createBottomTabNavigator();

const icon =
	(
		active: keyof typeof Ionicons.glyphMap,
		inactive: keyof typeof Ionicons.glyphMap,
	) =>
	({
		focused,
		color,
		size,
	}: {
		focused: boolean;
		color: string;
		size: number;
	}) => (
		<Ionicons
			name={focused ? active : inactive}
			size={size}
			color={color}
		/>
	);

const HomeTabs = () => {
	const { preferences } = useCompany();

	return (
		<Tab.Navigator
			screenOptions={{
				tabBarShowLabel: false,
				tabBarStyle: { paddingVertical: 5 },
			}}
		>
			<Tab.Screen
				name="Calendar"
				component={CalendarStack}
				options={{
					headerShown: false,
					tabBarIcon: icon("calendar", "calendar-outline"),
				}}
			/>
			{preferences.enableAvailability && (
				<Tab.Screen
					name="Availability"
					component={AvailabilityStack}
					options={{
						headerShown: false,
						tabBarIcon: icon("people", "people-outline"),
					}}
				/>
			)}
			{preferences.enableTimeSheet && (
				<Tab.Screen
					name="Clock"
					component={ClockStack}
					options={{
						headerShown: false,
						tabBarIcon: icon("time", "time-outline"),
					}}
				/>
			)}
			<Tab.Screen
				name="Settings"
				component={SettingStack}
				options={{
					headerShown: false,
					tabBarIcon: icon("settings", "settings-outline"),
				}}
			/>
		</Tab.Navigator>
	);
};

export default HomeTabs;
