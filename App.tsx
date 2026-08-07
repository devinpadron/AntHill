import React, { useEffect, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { registerKvStore } from "./src/lib/kvStore";
/*
 * Imported for its SIDE EFFECT, and it has to be at module scope of the entry
 * file.
 *
 * When the OS wakes the app to deliver a background location or a geofence
 * crossing, it boots the bundle and immediately looks for a task registered
 * under that name. Only definitions that ran during the boot exist at that
 * moment — anything inside a component or an effect has not, because no tree
 * mounted. An unregistered task drops the event silently, which is exactly how
 * background tracking appears to work in testing and then does nothing in the
 * field. Do not move this into a provider.
 */
import "./src/lib/locationTasks";
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
import { CompanySwitcherProvider } from "./src/components/company/CompanySwitcher";
import { useHideNativeSplash } from "./src/hooks/useHideNativeSplash";
import { DatabaseBadge } from "./src/components/dev/DatabaseBadge";
import {
	ThemeProvider,
	ThemeSync,
	navigationThemeFor,
	useTheme,
} from "./src/theme";

/*
 * The key-value backend for shared code (the upload queue, the SWR cache).
 *
 * REGISTERED HERE, NOT IN index.js. `main` in package.json points at
 * node_modules/expo/AppEntry.js, which imports THIS file directly — index.js is
 * never evaluated, so a registration there never runs and the first
 * uploadQueue read throws "No KvStore registered".
 *
 * Module scope, so it lands before any provider mounts. Nothing calls kv() at
 * import time — only inside effects and handlers — so this is early enough.
 *
 * src/services may not import AsyncStorage itself: the web portal compiles
 * those files and has no such dependency. See src/lib/kvStore.ts.
 */
registerKvStore({
	getItem: (key) => AsyncStorage.getItem(key),
	setItem: (key, value) => AsyncStorage.setItem(key, value),
	removeItem: (key) => AsyncStorage.removeItem(key),
	getAllKeys: () => AsyncStorage.getAllKeys(),
});

/*
 * Dev-only diagnostics harness.
 *
 * Mounts the real contexts against the `test` database, with a navigator whose
 * route NAMES match production, so screens navigate exactly as they do in the
 * real app. Deliberately omits AppGate and NotificationProvider: it exists to
 * inspect the data path, and pushes would only add moving parts.
 */
const DiagnosticsApp = () => {
	useHideNativeSplash();

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<ThemeProvider>
					<UploadManagerProvider>
						<UserProvider>
							<ThemeSync />
							<CompanyProvider>
								<DiagnosticsNavigator />
							</CompanyProvider>
						</UserProvider>
					</UploadManagerProvider>
				</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
};

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
 * Everything below the theme.
 *
 * Split out of MainApp only because it needs `useTheme()`, which has to be read
 * beneath ThemeProvider — the navigator is themed from our tokens so pushes do
 * not flash a white card in dark mode.
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
const ThemedApp: React.FC = () => {
	const theme = useTheme();

	// Lifts the launch screen once this tree has painted a themed frame.
	useHideNativeSplash();

	/*
	 * Memoized on the theme itself. Rebuilding this object on every render
	 * handed NavigationContainer a new `theme` prop each time, making it
	 * re-apply its colours for renders where nothing about the theme moved.
	 */
	const navigationTheme = useMemo(() => navigationThemeFor(theme), [theme]);

	return (
		<AppGate>
			<UploadManagerProvider>
				<UserProvider>
					{/* Applies the account's saved appearance choice. */}
					<ThemeSync />
					<CompanyProvider>
						<NavigationContainer
							ref={navigationRef}
							theme={navigationTheme}
							onReady={() => {
								pendingNavigation.executeIfReady();
							}}
						>
							<NotificationProvider>
								<NotifierWrapper>
									<LaunchTelemetry />
									{/* Renders the switcher sheet over the navigator. */}
									<CompanySwitcherProvider>
										<AppNavigator />
										{/* Dev-only; renders null in a release build. */}
										<DatabaseBadge />
									</CompanySwitcherProvider>
								</NotifierWrapper>
							</NotificationProvider>
						</NavigationContainer>
					</CompanyProvider>
				</UserProvider>
			</UploadManagerProvider>
		</AppGate>
	);
};

/** The app. */
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
				<ThemeProvider>
					<ThemedApp />
				</ThemeProvider>
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
