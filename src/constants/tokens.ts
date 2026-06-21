/**
 * Design System Tokens
 *
 * Scales for spacing, typography, radius, shadow, motion.
 * Updated from the Claude Design hand-off (`tokens.css`).
 *
 * Conventions:
 *  - Spacing on a 4px base.
 *  - Radius scale goes sm → 2xl → pill, matching the cream-paper cards.
 *  - Shadows are 3-stop (soft 1, lifted 2, floating 3) — ink-tinted, very low opacity.
 *  - Type pairs Instrument Serif (display) + Geist (UI) + Geist Mono (numerics).
 */

// ────────────────────────────────────────────────────────────
// Spacing — 4px base
// ────────────────────────────────────────────────────────────

export const Spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	xxl: 24,
	xxxl: 32,
} as const;

// ────────────────────────────────────────────────────────────
// Type scale
// ────────────────────────────────────────────────────────────

export const FontFamily = {
	display: "InstrumentSerif",
	displayItalic: "InstrumentSerif-Italic",
	ui: "Geist",
	mono: "GeistMono",
	// fallback for places not yet font-loader-aware
	system: undefined as unknown as string | undefined,
} as const;

export const FontSize = {
	small: 12,
	caption: 13,
	body: 15,
	h3: 17,
	h2: 19,
	h1: 22,
	display: 34,
	displayLg: 38,
} as const;

export const FontWeight = {
	normal: "400" as const,
	medium: "500" as const,
	semibold: "600" as const,
	bold: "700" as const,
};

export const LineHeight = {
	small: 16,
	caption: 18,
	body: 22,
	h3: 24,
	h2: 26,
	h1: 28,
	display: 36,
	displayLg: 40,
} as const;

export const LetterSpacing = {
	tight: -0.5,
	tighter: -0.3,
	normal: 0,
	wide: 0.4,
	eyebrow: 1.6,
} as const;

// ────────────────────────────────────────────────────────────
// Radius
// ────────────────────────────────────────────────────────────

export const BorderRadius = {
	none: 0,
	sm: 8,
	md: 12,
	lg: 18,
	xl: 24,
	xxl: 32,
	pill: 9999,
	round: 9999,
} as const;

export const BorderWidth = {
	hairline: 0.5,
	thin: 1,
	medium: 1.5,
	thick: 2,
} as const;

// ────────────────────────────────────────────────────────────
// Shadow — ink-tinted (#1D1D27), very subtle
// ────────────────────────────────────────────────────────────

const INK_SHADOW = "#1D1D27";

export const Shadow = {
	none: {
		shadowColor: INK_SHADOW,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0,
		shadowRadius: 0,
		elevation: 0,
	},
	sm: {
		shadowColor: INK_SHADOW,
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.04,
		shadowRadius: 2,
		elevation: 1,
	},
	md: {
		shadowColor: INK_SHADOW,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.06,
		shadowRadius: 12,
		elevation: 3,
	},
	lg: {
		shadowColor: INK_SHADOW,
		shadowOffset: { width: 0, height: 10 },
		shadowOpacity: 0.1,
		shadowRadius: 24,
		elevation: 6,
	},
	xl: {
		shadowColor: INK_SHADOW,
		shadowOffset: { width: 0, height: 18 },
		shadowOpacity: 0.14,
		shadowRadius: 36,
		elevation: 10,
	},
} as const;

// ────────────────────────────────────────────────────────────
// Sizes
// ────────────────────────────────────────────────────────────

export const IconSize = {
	xs: 14,
	sm: 18,
	md: 22,
	lg: 28,
	xl: 36,
} as const;

export const AvatarSize = {
	xs: 24,
	sm: 32,
	md: 38,
	lg: 56,
	xl: 80,
} as const;

export const ButtonHeight = {
	sm: 36,
	md: 48,
	lg: 56,
} as const;

export const Opacity = {
	disabled: 0.45,
	subtle: 0.6,
	medium: 0.8,
	visible: 1,
} as const;

export const ZIndex = {
	base: 0,
	dropdown: 1000,
	sticky: 1100,
	overlay: 1200,
	modal: 1300,
	popover: 1400,
	toast: 1500,
} as const;

// ────────────────────────────────────────────────────────────
// Motion
// ────────────────────────────────────────────────────────────

export const Duration = {
	instant: 0,
	fast: 150,
	normal: 240,
	slow: 400,
} as const;

export const Breakpoint = {
	mobile: 0,
	tablet: 600,
	desktop: 1024,
} as const;

// ────────────────────────────────────────────────────────────
// Type exports
// ────────────────────────────────────────────────────────────

export type SpacingKey = keyof typeof Spacing;
export type FontSizeKey = keyof typeof FontSize;
export type FontWeightKey = keyof typeof FontWeight;
export type BorderRadiusKey = keyof typeof BorderRadius;
export type ShadowKey = keyof typeof Shadow;
export type IconSizeKey = keyof typeof IconSize;
export type AvatarSizeKey = keyof typeof AvatarSize;
export type ButtonHeightKey = keyof typeof ButtonHeight;
