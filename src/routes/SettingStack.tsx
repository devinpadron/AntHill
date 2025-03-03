import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Settings from "../screens/settings/Settings";
import ProfilePage from "../screens/settings/ProfilePage";
import EmployeeList from "../screens/settings/EmployeeList";

const Stack = createNativeStackNavigator();

const SettingStack = () => {
	return (
		<Stack.Navigator>
			<Stack.Screen
				name="Settings"
				component={Settings}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="Profile"
				component={ProfilePage}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
			<Stack.Screen
				name="EmployeeList"
				component={EmployeeList}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
		</Stack.Navigator>
	);
};

export default SettingStack;
