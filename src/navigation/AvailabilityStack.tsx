import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { stackScreenOptions } from "./stackOptions";
import AvailabilityPage from "../screens/availability/AvailabilityPage";
import EventDetails from "../screens/calendar/EventDetails";
import EventSubmit from "../screens/calendar/EventSubmit";

/* Mirrors the production AvailabilityStack — same route names, ported screens. */

const Stack = createNativeStackNavigator();

const AvailabilityStack = () => (
	<Stack.Navigator screenOptions={stackScreenOptions}>
		<Stack.Screen name="Availability" component={AvailabilityPage} />
		<Stack.Screen name="EventDetails" component={EventDetails} />
		<Stack.Screen name="EditEvent" component={EventSubmit} />
	</Stack.Navigator>
);

export default AvailabilityStack;
