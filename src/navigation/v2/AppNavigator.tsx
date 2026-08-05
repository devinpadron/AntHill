import React from "react";
import HomeTabs from "./HomeTabs";
import AuthStack from "./AuthStack";
import SplashScreen from "../../screens/SplashScreen";
import { useUser } from "../../contexts/v2/UserContext";

/*
 * The v2 root.
 *
 * Same shape as the v1 AppNavigator it replaces at cutover — splash while auth
 * resolves, then either the auth stack or the tabs. The only difference is
 * which tree it points at, which is the whole point: cutover is a one-line
 * import swap in App.tsx rather than a restructuring.
 *
 * `initializing` gates the splash and is deliberately distinct from
 * `isLoading`, which gates data. Conflating them would show the splash again
 * every time a company's data reloaded.
 */
export const AppNavigator = () => {
	const { loggedIn, initializing } = useUser();

	if (initializing) {
		return <SplashScreen />;
	}

	return loggedIn ? <HomeTabs /> : <AuthStack />;
};

export default AppNavigator;
