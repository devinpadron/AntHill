import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AvailabilityPage from "../screens/availability/AvailabilityPage";
import EventDetails from "../screens/calendar/EventDetails";
import EventSubmit from "../screens/calendar/EventSubmit";

const Stack = createNativeStackNavigator();

const AvailabilityStack = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen
				name="Availability"
				component={AvailabilityPage}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="EventDetails"
				component={EventDetails}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="EditEvent"
				component={EventSubmit}
				options={{ headerShown: false }}
			/>
		</Stack.Navigator>
	);
};

export default AvailabilityStack;
