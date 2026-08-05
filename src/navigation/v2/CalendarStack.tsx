import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CalendarScreen from "../../screens/calendar/v2/Calendar";
import EventDetails from "../../screens/calendar/v2/EventDetails";
import EventSubmit from "../../screens/calendar/v2/EventSubmit";
import EventChecklists from "../../screens/calendar/v2/EventChecklists";

/*
 * Mirrors the production CalendarStack exactly — same route names, same
 * options. Only the screen components differ, so navigation calls inside the
 * ported screens are identical to the ones they will use after cutover.
 */

const Stack = createNativeStackNavigator();

const CalendarStack = () => (
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
		<Stack.Screen
			name="EventChecklists"
			component={EventChecklists}
			options={{ headerShown: false, gestureEnabled: true }}
		/>
	</Stack.Navigator>
);

export default CalendarStack;
