import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { StyleSheet, useColorScheme, ViewStyle } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ColorScheme, ColorTokens, colorsFor } from "./themes";
import {
	elevation as elevationTokens,
	ElevationVariant,
	hairlineWidth,
	hitTarget,
	iconSize,
	motion,
	radius,
	spacing,
	type as typeTokens,
	TypeToken,
	TypeVariant,
} from "./tokens";

/**
 * The theme layer.
 *
 * Two things are deliberately separated here:
 *
 *   `mode`   — what the user ASKED for: "light" | "dark" | "system".
 *   `scheme` — what we actually render: "light" | "dark", after resolving
 *              "system" against the OS.
 *
 * Screens only ever care about `scheme` (via `useTheme()`); the settings UI is
 * the only thing that touches `mode`.
 *
 * The chosen mode is persisted twice, on purpose. AsyncStorage is the fast path
 * — it is read synchronously enough that the first painted frame is already the
 * right theme, which is the same reason `UserContext` caches AUTH_STATE. The
 * user settings document is the durable copy that follows the account across
 * devices, synced in by `ThemeSync` once the user has loaded.
 */

export type ThemeMode = "light" | "dark" | "system";

const THEME_MODE_KEY = "THEME_MODE";

const isThemeMode = (v: unknown): v is ThemeMode =>
	v === "light" || v === "dark" || v === "system";

export type Theme = {
	scheme: ColorScheme;
	isDark: boolean;
	colors: ColorTokens;
	spacing: typeof spacing;
	radius: typeof radius;
	type: Record<TypeVariant, TypeToken>;
	/** Elevation geometry with this theme's `shadowColor` already applied. */
	elevation: Record<ElevationVariant, ViewStyle>;
	motion: typeof motion;
	iconSize: typeof iconSize;
	hitTarget: number;
	hairlineWidth: number;
};

type ThemeContextValue = {
	theme: Theme;
	mode: ThemeMode;
	/** Persists to AsyncStorage immediately; Firestore is the caller's job. */
	setMode: (mode: ThemeMode) => void;
	/** True until the stored mode has been read back. */
	hydrating: boolean;
};

const buildTheme = (scheme: ColorScheme): Theme => {
	const colors = colorsFor(scheme);

	return {
		scheme,
		isDark: scheme === "dark",
		colors,
		spacing,
		radius,
		type: typeTokens,
		elevation: {
			none: elevationTokens.none,
			raised: { ...elevationTokens.raised, shadowColor: colors.shadow },
			floating: {
				...elevationTokens.floating,
				shadowColor: colors.shadow,
			},
		},
		motion,
		iconSize,
		hitTarget,
		hairlineWidth,
	};
};

const ThemeContext = createContext<ThemeContextValue>({
	theme: buildTheme("light"),
	mode: "system",
	setMode: () => {},
	hydrating: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const systemScheme = useColorScheme();
	const [mode, setModeState] = useState<ThemeMode>("system");
	const [hydrating, setHydrating] = useState(true);

	useEffect(() => {
		let cancelled = false;

		AsyncStorage.getItem(THEME_MODE_KEY)
			.then((stored) => {
				if (cancelled) return;
				if (isThemeMode(stored)) setModeState(stored);
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setHydrating(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const setMode = useCallback((next: ThemeMode) => {
		setModeState(next);
		AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => {});
	}, []);

	/*
	 * `useColorScheme()` returns null while the OS value is unknown (and always
	 * on some Android builds), so light is the fallback rather than a crash.
	 */
	const scheme: ColorScheme =
		mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

	const theme = useMemo(() => buildTheme(scheme), [scheme]);

	const value = useMemo(
		() => ({ theme, mode, setMode, hydrating }),
		[theme, mode, setMode, hydrating],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
};

/** The tokens. This is what screens and components use. */
export const useTheme = (): Theme => useContext(ThemeContext).theme;

/** The user's light/dark/system choice. Only the settings UI needs this. */
export const useThemeMode = () => {
	const { mode, setMode, theme, hydrating } = useContext(ThemeContext);
	return { mode, setMode, scheme: theme.scheme, hydrating };
};

/*
 * Styles are cached per (factory, scheme) rather than rebuilt on every render.
 *
 * A WeakMap keyed on the factory means a module-level factory — the intended
 * shape, and what every `*.styles.ts` file converts to — creates its
 * StyleSheet exactly once per theme for the whole app, not once per mounted
 * component. Entries disappear with the module if it is ever unloaded.
 */
type NamedStyles = Record<string, object>;

const styleCache = new WeakMap<
	(theme: Theme) => NamedStyles,
	Partial<Record<ColorScheme, NamedStyles>>
>();

/**
 * Turns a `(theme) => ({ ... })` factory into a memoized StyleSheet.
 *
 * Define the factory at module scope, never inline in a component — an inline
 * factory is a new object identity every render and would defeat the cache.
 */
export function useThemedStyles<T extends object>(
	factory: (theme: Theme) => T,
): T {
	const theme = useTheme();

	return useMemo(() => {
		let perScheme = styleCache.get(factory as (t: Theme) => NamedStyles);

		if (!perScheme) {
			perScheme = {};
			styleCache.set(factory as (t: Theme) => NamedStyles, perScheme);
		}

		const cached = perScheme[theme.scheme];
		if (cached) return cached as T;

		/*
		 * Cast because a factory may return an interface with named keys rather
		 * than an index signature — StyleSheet.create accepts either, but the
		 * cache is keyed generically.
		 */
		const created = StyleSheet.create(
			factory(theme) as NamedStyles,
		) as NamedStyles;
		perScheme[theme.scheme] = created;

		return created as T;
	}, [factory, theme]);
}
