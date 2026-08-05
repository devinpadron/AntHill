import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { V2SmokeScreen } from "../../screens/dev/V2SmokeScreen";
import HomeTabs from "./HomeTabs";
import { DiagnosticsBadge } from "../../screens/dev/DiagnosticsBadge";

/*
 * Dev harness entry point.
 *
 * The app itself is HomeTabs — the same tab structure production uses, so the
 * bottom bar and per-tab stacks behave exactly as they will after cutover. The
 * diagnostics screen sits alongside as a modal rather than wrapping the app, so
 * it is a debugging tool rather than part of the navigation shape.
 */

const Stack = createNativeStackNavigator();

/** HomeTabs plus a floating way into the diagnostics screen. */
const HomeWithBadge = () => (
	<>
		<HomeTabs />
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
