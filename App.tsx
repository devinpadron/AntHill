import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { AppNavigator } from "./src/routes/AppNavigator";
import { UserProvider, useUser } from "./src/contexts/UserContext";
import { CompanyProvider, useCompany } from "./src/contexts/CompanyContext";
import { Gesture, GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
				<UserProvider>
					<CompanyProvider>
						<CompanyInitializer />
						<AppNavigator />
					</CompanyProvider>
				</UserProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
};

export default App;
