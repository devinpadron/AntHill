import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NotifierWrapper } from "react-native-notifier";
import { NavigationContainer } from "@react-navigation/native";
import {
	navigationRef,
	pendingNavigation,
} from "./src/navigation/navigationRef";
import { AppGate } from "./src/components/ui/AppGate";
import { getCurrentAppVersion } from "./src/utils/versionUtils";
import { V2_SMOKE_TEST } from "./src/constants/devFlags";
import { AppNavigator } from "./src/navigation/v2/AppNavigator";
import { UserProvider, useUser } from "./src/contexts/v2/UserContext";
import { CompanyProvider } from "./src/contexts/v2/CompanyContext";
import { UploadManagerProvider } from "./src/contexts/v2/UploadManagerContext";
import { NotificationProvider } from "./src/contexts/v2/NotificationContext";
import { recordAppLaunch } from "./src/services/v2/userService";
import { UserProvider as V2UserProvider } from "./src/contexts/v2/UserContext";
import { CompanyProvider as V2CompanyProvider } from "./src/contexts/v2/CompanyContext";
import { UploadManagerProvider as V2UploadManagerProvider } from "./src/contexts/v2/UploadManagerContext";
import { V2SmokeNavigator } from "./src/navigation/v2/V2SmokeNavigator";

/*
 * Dev-only harness for the v2 stack.
 *
 * Mounts the real v2 contexts against the `test` database, with a navigator
 * whose route NAMES match production, so ported screens navigate exactly as
 * they will in the real app. No NotificationProvider — pushes would only add
 * moving parts to what is a data-path harness.
 */
const V2SmokeApp = () => (
	<GestureHandlerRootView style={{ flex: 1 }}>
		<SafeAreaProvider>
			<V2UploadManagerProvider>
				<V2UserProvider>
					<V2CompanyProvider>
						<V2SmokeNavigator />
					</V2CompanyProvider>
				</V2UserProvider>
			</V2UploadManagerProvider>
		</SafeAreaProvider>
	</GestureHandlerRootView>
);

/*
 * CompanyInitializer is GONE.
 *
 * v1 needed a bridge component to push `user.loggedInCompany` into
 * CompanyContext, because the two contexts did not know about each other. The
 * v2 CompanyProvider subscribes to `useUser().companyId` itself, so the active
 * company follows the user with no wiring in between — and there is no window
 * where the user has loaded but the company has not been told about it.
 *
 * Keeping it would also have been a live bug: it read `user.loggedInCompany`,
 * which does not exist in v2 (it is `loggedInCompanyId`), so it would have
 * silently never fired.
 */

// Records which build this user is on, so update adoption can be measured
// before a forced cutover. Best-effort and non-blocking.
const LaunchTelemetry = () => {
	const { userId, loggedIn } = useUser();

	useEffect(() => {
		if (loggedIn && userId) {
			recordAppLaunch(userId, getCurrentAppVersion());
		}
	}, [userId, loggedIn]);

	return null;
};

/*
 * The app.
 *
 * Reads and writes the v2 schema. The provider order is unchanged from v1 and
 * still matters: NotificationProvider sits INSIDE NavigationContainer because
 * push handling navigates, and AppGate wraps everything so a forced update or
 * a schema-version mismatch blocks the tree rather than rendering behind it.
 *
 * This build declares SUPPORTED_SCHEMA_VERSIONS = [2]. While the server still
 * says activeVersion 1 it gates ITSELF behind the update screen — which is what
 * lets the release sit in the store, approved and inert, until the migration
 * window actually flips the switch.
 */
const MainApp: React.FC = () => {
	// Add this effect to check pending navigation periodically
	useEffect(() => {
		// Check for pending navigation every 500ms for the first few seconds
		// This handles cases where navigation isn't immediately ready
		const checkInterval = setInterval(() => {
			pendingNavigation.executeIfReady();
		}, 500);

		// Clear interval after 5 seconds
		setTimeout(() => {
			clearInterval(checkInterval);
		}, 5000);

		return () => clearInterval(checkInterval);
	}, []);

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<AppGate>
					<UploadManagerProvider>
						<UserProvider>
							<CompanyProvider>
								<NavigationContainer
									ref={navigationRef}
									onReady={() => {
										pendingNavigation.executeIfReady();
									}}
								>
									<NotificationProvider>
										<NotifierWrapper>
											<LaunchTelemetry />
											<AppNavigator />
										</NotifierWrapper>
									</NotificationProvider>
								</NavigationContainer>
							</CompanyProvider>
						</UserProvider>
					</UploadManagerProvider>
				</AppGate>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
};

/*
 * Picks the tree. No hooks here, so the branch cannot violate the rules of
 * hooks — MainApp and V2SmokeApp each own their own state.
 */
const App: React.FC = () => (V2_SMOKE_TEST ? <V2SmokeApp /> : <MainApp />);

export default App;
