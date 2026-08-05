import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Settings from "../screens/settings/Settings";
import ProfilePage from "../screens/settings/ProfilePage";
import EmployeeList from "../screens/settings/admin/EmployeeList";
import CompanyPreferences from "../screens/settings/admin/CompanyPreferences";
import UserPreferences from "../screens/settings/UserPreferences";
import CompanyCustomForm from "../screens/settings/admin/CompanyCustomForm";
import ChecklistCreator from "../screens/settings/admin/ChecklistCreator";
import PackageCreator from "../screens/settings/admin/PackageCreator";
import LabelCreator from "../screens/settings/admin/LabelCreator";
import WorkerGroups from "../screens/settings/admin/WorkerGroups";
import PayrollReviewStack from "./PayrollReviewStack";

/*
 * Settings stack.
 *
 * Route names match production, and every screen here is now a ported v2
 * component — nothing in this stack reads the v1 schema.
 */

const Stack = createNativeStackNavigator();

const SettingStack = () => (
	<Stack.Navigator>
		<Stack.Screen
			name="Settings"
			component={Settings}
			options={{ headerShown: false, gestureEnabled: true }}
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
		<Stack.Screen
			name="WorkerGroups"
			component={WorkerGroups}
			options={{ headerShown: false, gestureEnabled: true }}
		/>
	</Stack.Navigator>
);

export default SettingStack;
