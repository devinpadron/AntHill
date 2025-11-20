/**
 * Design System Tokens
 *
 * Central definition of design tokens for the AntHill application.
 * These tokens define spacing, typography, border radius, shadows, and other
 * design primitives used throughout the UI component library.
 */

/**
 * Spacing Scale
 * Consistent spacing values used across all components
 */
export const Spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	xxl: 24,
	xxxl: 32,
} as const;

/**
 * Typography Scale
 * Font sizes for different text variants
 */
export const FontSize = {
	small: 12,
	caption: 14,
	body: 16,
	h3: 18,
	h2: 22,
	h1: 28,
} as const;

/**
 * Font Weights
 * Standard font weight values
 */
export const FontWeight = {
	normal: "400" as const,
	medium: "500" as const,
	semibold: "600" as const,
	bold: "700" as const,
} as const;

/**
 * Line Heights
 * Relative line heights for different text sizes
 */
export const LineHeight = {
	small: 16,
	caption: 20,
	body: 24,
	h3: 26,
	h2: 30,
	h1: 36,
} as const;

/**
 * Border Radius
 * Consistent border radius values for UI elements
 */
export const BorderRadius = {
	none: 0,
	sm: 4,
	md: 8,
	lg: 12,
	xl: 16,
	round: 9999, // Fully rounded
} as const;

/**
 * Border Widths
 */
export const BorderWidth = {
	thin: 1,
	medium: 2,
	thick: 3,
} as const;

/**
 * Shadows
 * Shadow presets for elevation
 */
export const Shadow = {
	none: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0,
		shadowRadius: 0,
		elevation: 0,
	},
	sm: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 2,
		elevation: 1,
	},
	md: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	lg: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 5,
	},
	xl: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.2,
		shadowRadius: 16,
		elevation: 8,
	},
} as const;

/**
 * Icon Sizes
 * Standard sizes for icons
 */
export const IconSize = {
	xs: 16,
	sm: 20,
	md: 24,
	lg: 32,
	xl: 40,
} as const;

/**
 * Avatar Sizes
 * Standard sizes for avatar components
 */
export const AvatarSize = {
	xs: 24,
	sm: 32,
	md: 40,
	lg: 56,
	xl: 80,
} as const;

/**
 * Button Heights
 * Standard heights for button components
 */
export const ButtonHeight = {
	sm: 32,
	md: 44,
	lg: 52,
} as const;

/**
 * Opacity Values
 * Standard opacity values for various states
 */
export const Opacity = {
	disabled: 0.5,
	subtle: 0.6,
	medium: 0.8,
	visible: 1,
} as const;

/**
 * Z-Index Layers
 * Standard z-index values for layering
 */
export const ZIndex = {
	base: 0,
	dropdown: 1000,
	sticky: 1100,
	overlay: 1200,
	modal: 1300,
	popover: 1400,
	toast: 1500,
} as const;

/**
 * Animation Durations (in milliseconds)
 * Standard animation timing values
 */
export const Duration = {
	instant: 0,
	fast: 150,
	normal: 250,
	slow: 400,
} as const;

/**
 * Breakpoints
 * Responsive design breakpoints
 */
export const Breakpoint = {
	mobile: 0,
	tablet: 600,
	desktop: 1024,
} as const;

/**
 * Type exports for TypeScript
 */
export type SpacingKey = keyof typeof Spacing;
export type FontSizeKey = keyof typeof FontSize;
export type FontWeightKey = keyof typeof FontWeight;
export type BorderRadiusKey = keyof typeof BorderRadius;
export type ShadowKey = keyof typeof Shadow;
export type IconSizeKey = keyof typeof IconSize;
export type AvatarSizeKey = keyof typeof AvatarSize;
export type ButtonHeightKey = keyof typeof ButtonHeight;
