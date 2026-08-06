import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { stackScreenOptions } from "./stackOptions";
import TimeEntryScreen from "../screens/timesheet/TimeEntryScreen";
import TimeEntryDetails from "../screens/timesheet/TimeEntryDetails";

/* Mirrors the production ClockStack — same route names, ported screens. */

const Stack = createNativeStackNavigator();

const ClockStack = () => (
	<Stack.Navigator screenOptions={stackScreenOptions}>
		<Stack.Screen name="TimeEntryScreen" component={TimeEntryScreen} />
		<Stack.Screen name="TimeEntryDetails" component={TimeEntryDetails} />
	</Stack.Navigator>
);

export default ClockStack;
