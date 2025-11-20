import React, { createContext, useContext, useState, ReactNode } from "react";
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
	const [mode, setMode] = useState<ThemeMode>("light");

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
