import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Settings from "../screens/settings/Settings";
import ProfilePage from "../screens/settings/ProfilePage";
import UserPreferences from "../screens/settings/UserPreferences";

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
				name="UserPreferences"
				component={UserPreferences}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
		</Stack.Navigator>
	);
};

export default SettingStack;
