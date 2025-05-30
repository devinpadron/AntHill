import React, { useEffect } from "react";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { UserProvider, useUser } from "./src/contexts/UserContext";
import { CompanyProvider, useCompany } from "./src/contexts/CompanyContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UploadManagerProvider } from "./src/contexts/UploadManagerContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";
import { NotifierWrapper } from "react-native-notifier";
import { NavigationContainer } from "@react-navigation/native";
import {
	navigationRef,
	pendingNavigation,
} from "./src/navigation/navigationRef";

// Component to initialize the company context after user auth
const CompanyInitializer = () => {
	const { user } = useUser();
	const { setActiveCompany } = useCompany();

	useEffect(() => {
		if (user?.loggedInCompany) {
			setActiveCompany(user.loggedInCompany);
		}
	}, [user?.loggedInCompany]);

	return null;
};

const App: React.FC = () => {
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
										<CompanyInitializer />
										<AppNavigator />
									</NotifierWrapper>
								</NotificationProvider>
							</NavigationContainer>
						</CompanyProvider>
					</UserProvider>
				</UploadManagerProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
};

export default App;
