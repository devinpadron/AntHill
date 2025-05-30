import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TimeEntryScreen from "../screens/timesheet/TimeEntryScreen";
import TimeEntryDetails from "../screens/timesheet/TimeEntryDetails";

const Stack = createNativeStackNavigator();

const ClockStack = () => {
	return (
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
};

export default ClockStack;
