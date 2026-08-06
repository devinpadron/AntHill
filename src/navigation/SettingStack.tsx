import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { stackScreenOptions } from "./stackOptions";
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
	<Stack.Navigator screenOptions={stackScreenOptions}>
		<Stack.Screen name="Settings" component={Settings} />
		<Stack.Screen name="Profile" component={ProfilePage} />
		<Stack.Screen name="EmployeeList" component={EmployeeList} />
		<Stack.Screen name="PayrollReview" component={PayrollReviewStack} />
		<Stack.Screen name="CompanyCustomForm" component={CompanyCustomForm} />
		<Stack.Screen
			name="CompanyPreferences"
			component={CompanyPreferences}
		/>
		<Stack.Screen name="UserPreferences" component={UserPreferences} />
		<Stack.Screen name="ChecklistCreator" component={ChecklistCreator} />
		<Stack.Screen name="PackageCreator" component={PackageCreator} />
		<Stack.Screen name="LabelCreator" component={LabelCreator} />
		<Stack.Screen name="WorkerGroups" component={WorkerGroups} />
	</Stack.Navigator>
);

export default SettingStack;
