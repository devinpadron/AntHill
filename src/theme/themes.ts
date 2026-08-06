/**
 * Semantic color tokens — the vocabulary screens actually use.
 *
 * Every entry is named for its ROLE, never its value, so the same style works
 * in both modes. A screen asks for `colors.surface`, not "white"; that is the
 * whole reason a dark theme is possible without touching the screen.
 */

import { accent, constant, dark, neutral, status } from "./palette";

export type ColorTokens = {
	/* surfaces */
	/** The page behind everything. */
	bg: string;
	/** Cards, headers, the tab bar — content sitting on `bg`. */
	surface: string;
	/** Sheets, menus, anything floating above `surface`. */
	surfaceRaised: string;
	/** Inset wells — inputs, code chips, grouped list backgrounds. */
	surfaceSunken: string;
	/** Pressed state for any surface-colored pressable. */
	surfacePressed: string;

	/* lines */
	/** Hairline separators and card outlines. */
	border: string;
	/** Input outlines and anything needing a visible edge. */
	borderStrong: string;

	/* text */
	text: string;
	textSecondary: string;
	textTertiary: string;
	/** Text on a filled accent/danger surface. */
	textInverse: string;

	/* accent */
	accent: string;
	accentPressed: string;
	/** Tinted fill behind selected rows and subtle badges. */
	accentSubtle: string;
	accentBorder: string;
	/** Foreground on a filled accent surface. */
	onAccent: string;

	/* status */
	success: string;
	successSubtle: string;
	warning: string;
	warningSubtle: string;
	danger: string;
	dangerSubtle: string;
	info: string;
	infoSubtle: string;

	/* misc */
	/** Scrim behind modals and sheets. */
	overlay: string;
	shadow: string;
	/** Track color for an unchecked switch. */
	switchTrack: string;
	/** Skeleton placeholder fill. */
	skeleton: string;
};

export const lightColors: ColorTokens = {
	bg: neutral[50],
	surface: neutral[0],
	surfaceRaised: neutral[0],
	surfaceSunken: neutral[100],
	surfacePressed: neutral[100],

	border: neutral[200],
	borderStrong: neutral[300],

	text: neutral[900],
	textSecondary: neutral[600],
	textTertiary: neutral[400],
	textInverse: neutral[0],

	accent: accent[500],
	accentPressed: accent[700],
	accentSubtle: accent[50],
	accentBorder: accent[200],
	onAccent: neutral[0],

	success: status.success,
	successSubtle: "#E8F3EA",
	warning: status.warning,
	warningSubtle: "#FBF1E0",
	danger: status.danger,
	dangerSubtle: "#F9E7E5",
	info: accent[600],
	infoSubtle: accent[50],

	overlay: "rgba(23, 24, 28, 0.45)",
	shadow: constant.black,
	switchTrack: neutral[300],
	skeleton: neutral[100],
};

export const darkColors: ColorTokens = {
	bg: dark.bg,
	surface: dark.surface,
	surfaceRaised: dark.raised,
	surfaceSunken: dark.sunken,
	surfacePressed: dark.raised,

	border: dark.border,
	borderStrong: dark.borderStrong,

	text: "#F2F3EF",
	textSecondary: "#A8ADA2",
	textTertiary: "#6B6F66",
	/*
	 * Deliberately dark, not white: in dark mode the accent fill is `accent[300]`
	 * — a light olive — so foreground on it has to go the other way.
	 */
	textInverse: neutral[950],

	accent: accent[300],
	accentPressed: accent[400],
	accentSubtle: "rgba(168, 191, 110, 0.14)",
	accentBorder: "rgba(168, 191, 110, 0.32)",
	onAccent: neutral[950],

	success: status.successDark,
	successSubtle: "rgba(111, 191, 127, 0.15)",
	warning: status.warningDark,
	warningSubtle: "rgba(224, 163, 62, 0.15)",
	danger: status.dangerDark,
	dangerSubtle: "rgba(232, 112, 95, 0.15)",
	info: accent[300],
	infoSubtle: "rgba(168, 191, 110, 0.14)",

	overlay: "rgba(0, 0, 0, 0.6)",
	/*
	 * Shadows are nearly invisible on near-black anyway; keeping them black
	 * rather than tinted avoids a muddy halo around raised surfaces.
	 */
	shadow: constant.black,
	switchTrack: dark.borderStrong,
	skeleton: dark.raised,
};

export type ColorScheme = "light" | "dark";

export const colorsFor = (scheme: ColorScheme): ColorTokens =>
	scheme === "dark" ? darkColors : lightColors;
