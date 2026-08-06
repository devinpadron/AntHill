/**
 * The design system's public surface. Import from `"../theme"`, not from the
 * individual modules — `palette.ts` in particular is private to `themes.ts`.
 */

export {
	ThemeProvider,
	useTheme,
	useThemeMode,
	useThemedStyles,
} from "./ThemeContext";
export type { Theme, ThemeMode } from "./ThemeContext";

export { ThemeSync, useThemePreference } from "./ThemeSync";
export { navigationThemeFor } from "./navigationTheme";

export { haptics } from "./haptics";
export type { Haptic } from "./haptics";

export type { ColorScheme, ColorTokens } from "./themes";
export type { ElevationVariant, IconSizeToken, TypeVariant } from "./tokens";
