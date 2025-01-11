import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ExpandableCalendarScreen from "../screens/home/calendar/Calendar";
import EventDetails from "../screens/home/calendar/EventDetails";

const Stack = createNativeStackNavigator();

const SettingStack = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen
				name="Calendar"
				component={ExpandableCalendarScreen}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="Details"
				component={EventDetails}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
		</Stack.Navigator>
	);
};

export default SettingStack;
