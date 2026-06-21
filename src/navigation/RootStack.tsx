import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeTabs from "./HomeTabs";
import NotificationsScreen from "../screens/notifications/NotificationsScreen";

const Stack = createNativeStackNavigator();

const RootStack = () => (
	<Stack.Navigator screenOptions={{ headerShown: false }}>
		<Stack.Screen name="HomeTabs" component={HomeTabs} />
		<Stack.Screen
			name="Notifications"
			component={NotificationsScreen}
			options={{
				presentation: "modal",
				animation: "slide_from_bottom",
			}}
		/>
	</Stack.Navigator>
);

export default RootStack;
