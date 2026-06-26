import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CalendarScreen from "../screens/calendar/Calendar";
import EventDetails from "../screens/calendar/EventDetails";
import EventChecklists from "../screens/calendar/EventChecklists";

const Stack = createNativeStackNavigator();

const CalendarStack = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen
				name="Calendar"
				component={CalendarScreen}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="Details"
				component={EventDetails}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
			<Stack.Screen
				name="EventChecklists"
				component={EventChecklists}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
		</Stack.Navigator>
	);
};

export default CalendarStack;
