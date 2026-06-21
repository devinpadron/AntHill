/**
 * AntHill Color Tokens
 *
 * Translated from the Claude Design hand-off (`tokens.css`).
 * The palette is warm earthy cream + ink, with olive and terra accents.
 *
 * Three layers:
 *  - Palette ramps (Cream/Ink/Olive/Terra/Amber/Rust/Info/Lines)
 *  - Theme objects (AntHill_Light / AntHill_Dark) — semantic mapping
 *  - Legacy aliases on the theme so existing screens keep compiling
 *
 * Source of truth for any new code is the ramps + semantic theme keys.
 */

// ────────────────────────────────────────────────────────────
// Brand
// ────────────────────────────────────────────────────────────

export const AntHill = {
	Black: "#1D1D27",
	White: "#DBDCD7",
	Cream: "#E9E1D6",
	Khaki: "#B5A291",
	Green: "#2F3B16",
};

// ────────────────────────────────────────────────────────────
// Palette ramps
// ────────────────────────────────────────────────────────────

export const Cream = {
	50: "#FBF8F1",
	100: "#F5EFE3",
	200: "#ECE3D0",
	300: "#D8C9AF",
	paper: "#FFFEFA",
};

export const Ink = {
	900: "#1D1D27",
	700: "#3A3742",
	500: "#6B6657",
	400: "#8A8473",
	300: "#B0A892",
};

export const Line = {
	default: "#E5DAC1",
	soft: "#EDE3CC",
	strong: "#C8BB9F",
};

export const Olive = {
	700: "#475821",
	600: "#5C7027",
	500: "#6B8E23",
	200: "#C9D4A4",
	100: "#E7E9D4",
	50: "#F2F3E3",
};

export const Terra = {
	700: "#8E4029",
	500: "#C26543",
	300: "#E0A185",
	100: "#F2D9CB",
	50: "#F9EAE0",
};

export const Amber = {
	600: "#A8821F",
	500: "#C89A2C",
	100: "#F0E0BE",
};

export const Rust = {
	600: "#8E3823",
	500: "#A8442B",
	100: "#EFC9BC",
};

export const Info = {
	500: "#3F7184",
	100: "#CFE1E7",
};

// ────────────────────────────────────────────────────────────
// Clock status (kept for backwards compat with timesheet)
// ────────────────────────────────────────────────────────────

export const Clock = {
	ClockIn: Olive[600],
	ClockOut: Rust[500],
};

// ────────────────────────────────────────────────────────────
// Theme — Light
// ────────────────────────────────────────────────────────────

export const AntHill_Light = {
	// Surfaces
	Background: Cream[100],
	Surface: Cream.paper,
	Surface2: Cream[50],
	CardBackground: Cream.paper,

	// Text
	PrimaryText: Ink[900],
	SecondaryText: Ink[500],
	TertiaryText: Ink[400],

	// Lines
	BorderColor: Line.default,
	BorderSoft: Line.soft,
	BorderStrong: Line.strong,

	// Accents
	Accent: Olive[600],
	AccentStrong: Olive[700],
	AccentSoft: Olive[100],
	Warm: Terra[500],
	WarmSoft: Terra[100],

	// Status
	Success: Olive[600],
	Warning: Amber[600],
	WarningSoft: Amber[100],
	Error: Rust[500],
	ErrorSoft: Rust[100],
	InfoStrong: Info[500],
	InfoSoft: Info[100],

	// Legacy aliases — keep existing screens working
	DateBadge: Cream[100],
	SearchBar: Cream[200],
	ProfileBackground: Olive[100],
	LocationBlue: Info[500],
	NotificationGreen: Olive[600],
	FABGreen: Olive[600],
};

// ────────────────────────────────────────────────────────────
// Theme — Dark
// ────────────────────────────────────────────────────────────

export const AntHill_Dark = {
	// Surfaces
	Background: Ink[900],
	Surface: "#26252F",
	Surface2: "#2E2D38",
	CardBackground: "#26252F",

	// Text
	PrimaryText: Cream[50],
	SecondaryText: Ink[300],
	TertiaryText: Ink[400],

	// Lines
	BorderColor: "#3A3A47",
	BorderSoft: "#332F3C",
	BorderStrong: "#4A4655",

	// Accents (lighter on dark surfaces for contrast)
	Accent: Olive[500],
	AccentStrong: Olive[200],
	AccentSoft: "#2F3B16",
	Warm: Terra[300],
	WarmSoft: "#5A2E20",

	// Status
	Success: Olive[500],
	Warning: Amber[500],
	WarningSoft: "#5C4519",
	Error: Terra[500],
	ErrorSoft: "#5A2E20",
	InfoStrong: Info[500],
	InfoSoft: "#22414B",

	// Legacy aliases
	DateBadge: "#353542",
	SearchBar: "#3A3A47",
	ProfileBackground: "#2F3B16",
	LocationBlue: Info[500],
	NotificationGreen: Olive[500],
	FABGreen: Olive[500],
};

export type ThemeColors = typeof AntHill_Light;
