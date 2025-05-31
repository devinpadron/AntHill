import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Settings from "../screens/settings/Settings";
import ProfilePage from "../screens/settings/ProfilePage";
import EmployeeList from "../screens/settings/admin/EmployeeList";
import PayrollReviewStack from "../navigation/PayrollReviewStack";
import CompanyCustomForm from "../screens/settings/admin/CompanyCustomForm";
import CompanyPreferences from "../screens/settings/admin/CompanyPreferences";
import UserPreferences from "../screens/settings/UserPreferences";
import ChecklistCreator from "../screens/settings/admin/ChecklistCreator";
import PackageCreator from "../screens/settings/admin/PackageCreator";
import LabelCreator from "../screens/settings/admin/LabelCreator";

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
			<Stack.Screen
				name="CompanyPreferences"
				component={CompanyPreferences}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
			<Stack.Screen
				name="UserPreferences"
				component={UserPreferences}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
			<Stack.Screen
				name="ChecklistCreator"
				component={ChecklistCreator}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
			<Stack.Screen
				name="PackageCreator"
				component={PackageCreator}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
			<Stack.Screen
				name="LabelCreator"
				component={LabelCreator}
				options={{ headerShown: false, gestureEnabled: true }}
			/>
		</Stack.Navigator>
	);
};

export default SettingStack;
