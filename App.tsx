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
import { DIAGNOSTICS_MODE } from "./src/constants/devFlags";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { UserProvider, useUser } from "./src/contexts/UserContext";
import { CompanyProvider } from "./src/contexts/CompanyContext";
import { UploadManagerProvider } from "./src/contexts/UploadManagerContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";
import { recordAppLaunch } from "./src/services/userService";
import { DiagnosticsNavigator } from "./src/navigation/DiagnosticsNavigator";

/*
 * Dev-only diagnostics harness.
 *
 * Mounts the real contexts against the `test` database, with a navigator whose
 * route NAMES match production, so screens navigate exactly as they do in the
 * real app. Deliberately omits AppGate and NotificationProvider: it exists to
 * inspect the data path, and pushes would only add moving parts.
 */
const DiagnosticsApp = () => (
	<GestureHandlerRootView style={{ flex: 1 }}>
		<SafeAreaProvider>
			<UploadManagerProvider>
				<UserProvider>
					<CompanyProvider>
						<DiagnosticsNavigator />
					</CompanyProvider>
				</UserProvider>
			</UploadManagerProvider>
		</SafeAreaProvider>
	</GestureHandlerRootView>
);

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
 * Provider order matters in two places. NotificationProvider sits INSIDE
 * NavigationContainer because push handling navigates. AppGate wraps
 * everything, so a forced update or a schema-version mismatch blocks the tree
 * rather than rendering behind it.
 *
 * CompanyProvider needs no wiring to follow the user: it subscribes to
 * `useUser().companyId` itself, so there is no window where the user has
 * loaded but the active company has not been told about it.
 */
const MainApp: React.FC = () => {
	/*
	 * A push can arrive before the navigator mounts, in which case the route is
	 * queued rather than lost. NavigationContainer's onReady covers the usual
	 * case; this polls alongside it to cover a notification that lands during
	 * the mount itself, then gives up after 5s.
	 */
	useEffect(() => {
		const checkInterval = setInterval(() => {
			pendingNavigation.executeIfReady();
		}, 500);

		const stopPolling = setTimeout(() => {
			clearInterval(checkInterval);
		}, 5000);

		return () => {
			clearInterval(checkInterval);
			clearTimeout(stopPolling);
		};
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
 * hooks — MainApp and DiagnosticsApp each own their own state.
 */
const App: React.FC = () =>
	DIAGNOSTICS_MODE ? <DiagnosticsApp /> : <MainApp />;

export default App;
