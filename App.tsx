import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { UserProvider } from "./src/contexts/UserContext";
import { NotificationProvider } from "./src/contexts/NotificationContext";
import { AppNavigator } from "./src/routes/AppNavigator";

const App: React.FC = () => {
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
