import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import TodayScreen from "../screens/today/TodayScreen";
import CalendarStack from "./CalendarStack";
import SettingStack from "./SettingStack";
import ClockStack from "./ClockStack";
import AvailabilityStack from "./AvailabilityStack";
import { useCompany } from "../contexts/CompanyContext";
import { TabBar } from "../components/ui/TabBar";

const Tab = createBottomTabNavigator();

const HomeTabs = () => {
	const { preferences } = useCompany();

	return (
		<Tab.Navigator
			initialRouteName="Today"
			tabBar={(props) => <TabBar {...props} />}
			screenOptions={{
				headerShown: false,
				tabBarShowLabel: false,
			}}
		>
			<Tab.Screen
				name="Today"
				component={TodayScreen}
				options={{ tabBarLabel: "Today" }}
			/>
			<Tab.Screen
				name="Calendar"
				component={CalendarStack}
				options={{ tabBarLabel: "Calendar" }}
			/>
			{preferences.enableAvailability && (
				<Tab.Screen
					name="Availability"
					component={AvailabilityStack}
					options={{ tabBarLabel: "Shifts" }}
				/>
			)}
			{preferences.enableTimeSheet && (
				<Tab.Screen
					name="Clock"
					component={ClockStack}
					options={{ tabBarLabel: "Clock" }}
				/>
			)}
			<Tab.Screen
				name="Settings"
				component={SettingStack}
				options={{
					tabBarLabel: "Me",
					unmountOnBlur: false,
				}}
			/>
		</Tab.Navigator>
	);
};

export default HomeTabs;
