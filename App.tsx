import React, { useEffect } from "react";
import { AppNavigator } from "./src/routes/AppNavigator";
import { UserProvider, useUser } from "./src/contexts/UserContext";
import { CompanyProvider, useCompany } from "./src/contexts/CompanyContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UploadManagerProvider } from "./src/contexts/UploadManagerContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";

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
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<UploadManagerProvider>
					<UserProvider>
						<CompanyProvider>
							<NotificationProvider>
								<CompanyInitializer />
								<AppNavigator />
							</NotificationProvider>
						</CompanyProvider>
					</UserProvider>
				</UploadManagerProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
};

export default App;
