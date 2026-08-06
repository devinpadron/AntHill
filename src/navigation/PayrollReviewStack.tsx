import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { stackScreenOptions } from "./stackOptions";
import PayrollReview from "../screens/settings/admin/PayrollReview";
import TimeEntryDetails from "../screens/timesheet/TimeEntryDetails";

/*
 * Mirrors the production PayrollReviewStack — same route names, so the
 * navigate("PayrollDetails", …) calls inside PayrollReview are unchanged.
 */

const Stack = createNativeStackNavigator();

const PayrollReviewStack = () => (
	<Stack.Navigator screenOptions={stackScreenOptions}>
		<Stack.Screen name="PayrollReview" component={PayrollReview} />
		<Stack.Screen name="PayrollDetails" component={TimeEntryDetails} />
	</Stack.Navigator>
);

export default PayrollReviewStack;
