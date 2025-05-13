import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Settings from "../screens/settings/Settings";
import ProfilePage from "../screens/settings/ProfilePage";
import EmployeeList from "../screens/settings/admin/EmployeeList";
import PayrollReviewStack from "../routes/PayrollReviewStack";
import CompanyCustomForm from "../screens/settings/admin/CompanyCustomForm";

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
			<Stack.Screen
				name="PayrollReview"
				component={PayrollReviewStack}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
			<Stack.Screen
				name="CompanyCustomForm"
				component={CompanyCustomForm}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
		</Stack.Navigator>
	);
};

export default SettingStack;
