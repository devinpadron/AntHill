import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PayrollReview from "../screens/settings/admin/PayrollReview";
import TimeEntryDetails from "../screens/timesheet/TimeEntryDetails";

/*
 * Mirrors the production PayrollReviewStack — same route names, so the
 * navigate("PayrollDetails", …) calls inside PayrollReview are unchanged.
 */

const Stack = createNativeStackNavigator();

const PayrollReviewStack = () => (
	<Stack.Navigator>
		<Stack.Screen
			name="PayrollReview"
			component={PayrollReview}
			options={{ headerShown: false }}
		/>
		<Stack.Screen
			name="PayrollDetails"
			component={TimeEntryDetails}
			options={{ headerShown: false, gestureEnabled: true }}
		/>
	</Stack.Navigator>
);

export default PayrollReviewStack;
