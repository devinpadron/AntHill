import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CalendarScreen from "../screens/home/Calendar";
import EventDetails from "../screens/home/EventDetails";
import EventSubmit from "../screens/home/EventSubmit";

const Stack = createNativeStackNavigator();

const SettingStack = () => {
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
				name="EditEvent"
				component={EventSubmit}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
		</Stack.Navigator>
	);
};

export default SettingStack;
