import React, {
	createContext,
	useContext,
	useState,
	ReactNode,
	useEffect,
} from "react";
import { useColorScheme, Appearance } from "react-native";
import { AntHill_Light, AntHill_Dark } from "../constants/colors";

type ThemeColors = typeof AntHill_Light;
type ThemeMode = "light" | "dark";

interface ThemeContextType {
	theme: ThemeColors;
	mode: ThemeMode;
	toggleTheme: () => void;
	setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const systemColorScheme = useColorScheme();
	const [mode, setMode] = useState<ThemeMode>(systemColorScheme || "light");

	// Listen to system appearance changes
	useEffect(() => {
		console.log(`Initial system color scheme: ${systemColorScheme}`);

		const subscription = Appearance.addChangeListener(({ colorScheme }) => {
			console.log(`System appearance changed to: ${colorScheme}`);
			if (colorScheme) {
				setMode(colorScheme);
			}
		});

		return () => {
			subscription.remove();
		};
	}, []);

	const theme = mode === "light" ? AntHill_Light : AntHill_Dark;

	const toggleTheme = () => {
		setMode((prev) => (prev === "light" ? "dark" : "light"));
	};

	const setTheme = (newMode: ThemeMode) => {
		setMode(newMode);
	};

	return (
		<ThemeContext.Provider value={{ theme, mode, toggleTheme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
};

export const useTheme = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
};
