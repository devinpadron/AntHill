import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { V2SmokeScreen } from "../../screens/dev/V2SmokeScreen";
import { AppNavigator } from "./AppNavigator";
import { DiagnosticsBadge } from "../../screens/dev/DiagnosticsBadge";

/*
 * Dev harness entry point.
 *
 * The app itself is the v2 AppNavigator — the same splash / auth / tabs shape
 * production will use after cutover, so signup and login are exercised here
 * rather than being first tried in the release that depends on them. The
 * diagnostics screen sits alongside as a modal rather than wrapping the app, so
 * it is a debugging tool rather than part of the navigation shape.
 */

const Stack = createNativeStackNavigator();

/** The app plus a floating way into the diagnostics screen. */
const HomeWithBadge = () => (
	<>
		<AppNavigator />
		<DiagnosticsBadge />
	</>
);

export const V2SmokeNavigator = () => (
	<NavigationContainer>
		<Stack.Navigator>
			<Stack.Screen
				name="Home"
				component={HomeWithBadge}
				options={{ headerShown: false }}
			/>
			<Stack.Screen
				name="Diagnostics"
				component={V2SmokeScreen}
				options={{ presentation: "modal", title: "v2 diagnostics" }}
			/>
		</Stack.Navigator>
	</NavigationContainer>
);
