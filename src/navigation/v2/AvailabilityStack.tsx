import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AvailabilityPage from "../../screens/availability/v2/AvailabilityPage";
import EventDetails from "../../screens/calendar/v2/EventDetails";
import EventSubmit from "../../screens/calendar/v2/EventSubmit";

/* Mirrors the production AvailabilityStack — same route names, ported screens. */

const Stack = createNativeStackNavigator();

const AvailabilityStack = () => (
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

export default AvailabilityStack;
