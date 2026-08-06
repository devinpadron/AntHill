import { Theme as NavTheme } from "@react-navigation/native";
import { Theme } from "./ThemeContext";

/**
 * Bridges our tokens into React Navigation's own theme.
 *
 * Without this the navigator keeps its `DefaultTheme` — a white card background
 * and the stock iOS blue — which is what produces a white flash behind every
 * push transition in dark mode, and a blue tint on anything we have not styled
 * by hand.
 */
export const navigationThemeFor = (theme: Theme): NavTheme => ({
	dark: theme.isDark,
	colors: {
		primary: theme.colors.accent,
		/** The screen behind a transition — must match `Screen`'s background. */
		background: theme.colors.bg,
		/** Headers and the tab bar. */
		card: theme.colors.surface,
		text: theme.colors.text,
		border: theme.colors.border,
		/** Badge dots. */
		notification: theme.colors.danger,
	},
});
