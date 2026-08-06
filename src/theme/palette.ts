/**
 * Raw color ramps. The ONLY file in the app allowed to contain hex literals.
 *
 * Screens never import from here — they read semantic tokens off `useTheme()`,
 * which `themes.ts` builds from these ramps. Keeping the raw values behind that
 * indirection is what makes a second theme possible at all: before this file,
 * 143 distinct hex values were spread across 50 StyleSheet blocks, and six
 * different blues were all serving as "the accent".
 */

/**
 * The accent ramp, derived from the brand green.
 *
 * `accent[900]` is the original `AntHill.Green` (#2F3B16). It is far too dark
 * to carry interactive state — near-black on white, invisible on dark — so it
 * stays as the deep anchor and the ramp climbs out of it. Light mode uses 500,
 * dark mode uses 300; both clear WCAG AA against their own backgrounds.
 */
export const accent = {
	50: "#F2F5EA",
	100: "#E1E9CE",
	200: "#C7D69E",
	300: "#A8BF6E",
	400: "#8AA748",
	500: "#6B8A2E",
	600: "#5A7526",
	700: "#4A6120",
	800: "#3B4D1B",
	900: "#2F3B16",
} as const;

/**
 * Neutrals, warmed very slightly toward the accent's olive so white surfaces
 * sit with the green instead of fighting it. A pure-gray ramp next to an olive
 * accent reads cold.
 */
export const neutral = {
	0: "#FFFFFF",
	50: "#F7F8F5",
	100: "#EEF0EA",
	200: "#E8E9E4",
	300: "#D5D7D0",
	400: "#A8ADA2",
	500: "#878C81",
	600: "#6B6F66",
	700: "#4A4E47",
	800: "#2A2E28",
	900: "#17181C",
	950: "#0E100D",
} as const;

/** Dark-mode surfaces. Not a simple inversion of `neutral` — near-black
 *  backgrounds need their own steps to keep elevation legible. */
export const dark = {
	bg: "#0E100D",
	surface: "#171A15",
	raised: "#1F231C",
	sunken: "#0A0C09",
	border: "#2A2F26",
	borderStrong: "#3B4136",
} as const;

/** Status hues. One each — the app previously had e.g. `#ff9500` and `#FFA500`
 *  both meaning "paused", two lines apart. */
export const status = {
	success: "#3F8F4F",
	successDark: "#6FBF7F",
	warning: "#B7791F",
	warningDark: "#E0A33E",
	danger: "#C0392B",
	dangerDark: "#E8705F",
} as const;

/** Fixed values that do not vary by theme. */
export const constant = {
	white: "#FFFFFF",
	black: "#000000",
	transparent: "transparent",
} as const;
