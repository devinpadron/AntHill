import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UserProvider } from "./src/contexts/UserContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";
import { AppNavigator } from "./src/routes/AppNavigator";
import { checkAndRunMigrations } from "./src/utils/dbMigrationUtils";

const App: React.FC = () => {
	// Check and run migrations
	useEffect(() => {
		checkAndRunMigrations();
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
