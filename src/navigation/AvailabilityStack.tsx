import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AvailabilityPage from "../screens/availability/AvailabilityPage";

const Stack = createNativeStackNavigator();

const AvailabilityStack = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen
				name="Availability"
				component={AvailabilityPage}
				options={{ headerShown: false }}
			/>
		</Stack.Navigator>
	);
};

export default AvailabilityStack;
