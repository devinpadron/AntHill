import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { lightColors, darkColors, type ColorTokens } from "@app/theme/themes";
import { staticTokenCss } from "./tokens.web";

/*
 * Turns the app's semantic color tokens into CSS custom properties.
 *
 * lightColors/darkColors are imported DIRECTLY from ../../src/theme/themes.ts —
 * that file is plain object literals over palette.ts with no react-native
 * import, so the portal and the app read the same values from the same source
 * and cannot drift. Adding a token there makes it available here for free.
 *
 * Colors are written as inline custom properties on <html> rather than baked
 * into a stylesheet, so a theme switch is one property write. Nothing
 * re-renders and the big virtualized tables never repaint through JavaScript.
 *
 * Naming: camelCase token -> --c-kebab-case. `surfaceRaised` -> --c-surface-raised.
 */

const STORAGE_KEY = "PORTAL_THEME_MODE";

export type ThemeMode = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

type ThemeContextValue = {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
	/** The scheme actually in effect once "system" is resolved. */
	scheme: ColorScheme;
	colors: ColorTokens;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const kebab = (key: string) =>
	key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

function applyColors(colors: ColorTokens, scheme: ColorScheme) {
	const root = document.documentElement;
	for (const [key, value] of Object.entries(colors)) {
		root.style.setProperty(`--c-${kebab(key)}`, value);
	}
	// Lets CSS branch on the theme without prefers-color-scheme, and tells the
	// browser which scheme to use for scrollbars and form controls.
	root.dataset.theme = scheme;
	root.style.colorScheme = scheme;
}

function readStoredMode(): ThemeMode {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "system"
		? stored
		: "system";
}

/** Injected once — the token set that does not vary with the theme. */
let staticStyleInjected = false;
function injectStaticTokens() {
	if (staticStyleInjected) return;
	const style = document.createElement("style");
	style.dataset.anthillTokens = "";
	style.textContent = staticTokenCss();
	document.head.prepend(style);
	staticStyleInjected = true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
	const [systemScheme, setSystemScheme] = useState<ColorScheme>(() =>
		window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light",
	);

	// Track the OS setting so "system" stays live rather than sampling once.
	useEffect(() => {
		const query = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = (event: MediaQueryListEvent) =>
			setSystemScheme(event.matches ? "dark" : "light");
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	const scheme: ColorScheme = mode === "system" ? systemScheme : mode;
	const colors = scheme === "dark" ? darkColors : lightColors;

	useEffect(() => {
		injectStaticTokens();
	}, []);

	useEffect(() => {
		applyColors(colors, scheme);
	}, [colors, scheme]);

	const setMode = useCallback((next: ThemeMode) => {
		localStorage.setItem(STORAGE_KEY, next);
		setModeState(next);
	}, []);

	const value = useMemo(
		() => ({ mode, setMode, scheme, colors }),
		[mode, setMode, scheme, colors],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const value = useContext(ThemeContext);
	if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
	return value;
}
