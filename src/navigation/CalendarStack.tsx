import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { stackScreenOptions } from "./stackOptions";
import CalendarScreen from "../screens/calendar/Calendar";
import EventDetails from "../screens/calendar/EventDetails";
import EventSubmit from "../screens/calendar/EventSubmit";
import EventChecklists from "../screens/calendar/EventChecklists";

/*
 * Mirrors the production CalendarStack exactly — same route names, same
 * options. Only the screen components differ, so navigation calls inside the
 * ported screens are identical to the ones they will use after cutover.
 */

const Stack = createNativeStackNavigator();

const CalendarStack = () => (
	<Stack.Navigator screenOptions={stackScreenOptions}>
		<Stack.Screen name="Calendar" component={CalendarScreen} />
		<Stack.Screen name="Details" component={EventDetails} />
		<Stack.Screen name="EditEvent" component={EventSubmit} />
		<Stack.Screen name="EventChecklists" component={EventChecklists} />
	</Stack.Navigator>
);

export default CalendarStack;
