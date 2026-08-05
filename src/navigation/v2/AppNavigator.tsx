import React from "react";
import HomeTabs from "./HomeTabs";
import AuthStack from "./AuthStack";
import NoCompanyScreen from "../../screens/auth/v2/NoCompanyScreen";
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
	const { loggedIn, initializing, isLoading, companyId } = useUser();

	if (initializing) {
		return <SplashScreen />;
	}

	if (!loggedIn) {
		return <AuthStack />;
	}

	/*
	 * Signed in with no company.
	 *
	 * Gated on isLoading as well, or this flashes on every launch in the gap
	 * before the profile arrives — companyId is undefined then too, and the
	 * two states are indistinguishable from companyId alone.
	 *
	 * Without this the tabs mounted with an undefined company and every query
	 * ran against an empty id: a blank app, permission errors in the log, and
	 * no way back. removeMember produces exactly this state by design, since
	 * it clears loggedInCompanyId rather than deleting the profile.
	 */
	if (!isLoading && !companyId) {
		return <NoCompanyScreen />;
	}

	return <HomeTabs />;
};

export default AppNavigator;
