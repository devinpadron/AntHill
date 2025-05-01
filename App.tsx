import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UserProvider } from "./src/contexts/UserContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";
import { AppNavigator } from "./src/routes/AppNavigator";
import { checkAndRunMigrations } from "./src/utils/dbMigrationUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";

const App: React.FC = () => {
	// Check and run migrations
	useEffect(() => {
		checkAndRunMigrations();
		//AsyncStorage.setItem("app_schema_version", "0");
	}, []);

	// Initialize the app
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<UserProvider>
					<NotificationProvider>
						<AppNavigator />
					</NotificationProvider>
				</UserProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
};

export default App;
