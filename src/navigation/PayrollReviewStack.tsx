import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TimeEntryDetails from "../screens/timesheet/TimeEntryDetails";
import PayrollReview from "../screens/settings/admin/PayrollReview";

const Stack = createNativeStackNavigator();

const PayrollReviewStack = () => {
	return (
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
};

export default PayrollReviewStack;
