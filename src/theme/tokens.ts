/**
 * Non-color design tokens: spacing, radius, type, elevation, motion.
 *
 * These do not vary between light and dark, so they live outside `themes.ts`
 * and are spread onto the theme object by `ThemeContext`.
 */

import { Platform, TextStyle, ViewStyle } from "react-native";

/**
 * Spacing scale.
 *
 * The codebase had two competing families — 16/12/8/4 and a legacy 15/10/5 —
 * which is why padding varied between adjacent screens. Everything folds into
 * this one.
 */
export const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	"2xl": 32,
	"3xl": 40,
} as const;

/** Corner radii. Replaces 16 distinct hand-picked values. */
export const radius = {
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	pill: 999,
} as const;

/**
 * Type scale.
 *
 * `maxFontSizeMultiplier` is part of the token rather than left to call sites:
 * the layouts are dense, and uncapped Dynamic Type breaks row heights and
 * button labels. Larger text gets a tighter cap because it has less room to
 * grow before it wraps.
 */
export type TypeToken = {
	fontSize: number;
	lineHeight: number;
	fontWeight: TextStyle["fontWeight"];
	letterSpacing?: number;
	maxFontSizeMultiplier: number;
};

export const type = {
	display: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: "700",
		letterSpacing: -0.4,
		maxFontSizeMultiplier: 1.3,
	},
	title: {
		fontSize: 22,
		lineHeight: 28,
		fontWeight: "700",
		letterSpacing: -0.3,
		maxFontSizeMultiplier: 1.4,
	},
	heading: {
		fontSize: 17,
		lineHeight: 22,
		fontWeight: "600",
		letterSpacing: -0.2,
		maxFontSizeMultiplier: 1.5,
	},
	body: {
		fontSize: 15,
		lineHeight: 21,
		fontWeight: "400",
		maxFontSizeMultiplier: 1.6,
	},
	bodyStrong: {
		fontSize: 15,
		lineHeight: 21,
		fontWeight: "600",
		maxFontSizeMultiplier: 1.6,
	},
	label: {
		fontSize: 13,
		lineHeight: 17,
		fontWeight: "600",
		maxFontSizeMultiplier: 1.6,
	},
	caption: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: "400",
		maxFontSizeMultiplier: 1.6,
	},
	/** Uppercase section eyebrows — Settings groups, form section headers. */
	overline: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: "600",
		letterSpacing: 0.6,
		maxFontSizeMultiplier: 1.4,
	},
} as const satisfies Record<string, TypeToken>;

export type TypeVariant = keyof typeof type;

/**
 * Elevation.
 *
 * The design leans on hairlines, not shadows — `hairline` is the default for
 * cards and rows. `raised` and `floating` are reserved for things that genuinely
 * float above content (FABs, bottom sheets, sticky footers). Shadow color is
 * theme-dependent, so these carry only the geometry; `themes.ts` supplies
 * `shadowColor`.
 */
export const elevation = {
	none: {},
	raised: {
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 3,
	},
	floating: {
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.14,
		shadowRadius: 16,
		elevation: 8,
	},
} as const satisfies Record<string, ViewStyle>;

export type ElevationVariant = keyof typeof elevation;

/**
 * Motion.
 *
 * Reanimated is already installed with its babel plugin wired; these are the
 * shared configs so transitions across the app agree with each other instead of
 * each screen inventing its own timing.
 */
export const motion = {
	duration: {
		fast: 120,
		base: 200,
		slow: 320,
	},
	/** Press feedback — snappy, low overshoot. */
	springPress: {
		damping: 18,
		stiffness: 340,
		mass: 0.6,
	},
	/** Entrances and layout changes — a little softer. */
	springEnter: {
		damping: 20,
		stiffness: 180,
		mass: 0.9,
	},
	/** Scale a pressable settles to while held. */
	pressScale: 0.97,
} as const;

/** Minimum tappable size. Everything interactive must meet this. */
export const hitTarget = 44;

/** One hairline, resolved once rather than per component. */
export const hairlineWidth = Platform.select({
	ios: 0.5,
	default: 1,
}) as number;

/** Icon sizes, so glyphs across screens agree. */
export const iconSize = {
	xs: 14,
	sm: 18,
	md: 22,
	lg: 26,
	xl: 32,
} as const;

export type IconSizeToken = keyof typeof iconSize;
