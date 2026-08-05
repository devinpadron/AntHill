import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TimeEntryScreen from "../screens/timesheet/TimeEntryScreen";
import TimeEntryDetails from "../screens/timesheet/TimeEntryDetails";

/* Mirrors the production ClockStack — same route names, ported screens. */

const Stack = createNativeStackNavigator();

const ClockStack = () => (
	<Stack.Navigator>
		<Stack.Screen
			name="TimeEntryScreen"
			component={TimeEntryScreen}
			options={{ headerShown: false }}
		/>
		<Stack.Screen
			name="TimeEntryDetails"
			component={TimeEntryDetails}
			options={{ headerShown: false, gestureEnabled: true }}
		/>
	</Stack.Navigator>
);

export default ClockStack;
