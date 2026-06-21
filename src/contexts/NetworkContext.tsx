import React, {
	createContext,
	useContext,
	useEffect,
	useState,
	ReactNode,
} from "react";
import NetInfo from "@react-native-community/netinfo";

interface NetworkContextValue {
	isConnected: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
	isConnected: true,
});

/**
 * Subscribes once to NetInfo and exposes connectivity to the whole app.
 * `null` (unknown) is treated as connected to avoid a false "offline" flash on
 * cold start.
 */
export const NetworkProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const [isConnected, setIsConnected] = useState(true);

	useEffect(() => {
		const unsubscribe = NetInfo.addEventListener((state) => {
			setIsConnected(state.isConnected !== false);
		});
		return () => unsubscribe();
	}, []);

	return (
		<NetworkContext.Provider value={{ isConnected }}>
			{children}
		</NetworkContext.Provider>
	);
};

export const useNetwork = () => useContext(NetworkContext);
