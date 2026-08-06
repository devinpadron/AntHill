/*
 * Non-color design tokens, as CSS values.
 *
 * These mirror ../../src/theme/tokens.ts one-for-one. That file is NOT imported
 * because it pulls `Platform`, `TextStyle` and `ViewStyle` from react-native and
 * expresses elevation as RN shadow props, which have no CSS meaning. The
 * numbers below are the same numbers; if one changes there, change it here.
 *
 * Colors are a different story — themes.ts is pure object literals, so
 * ThemeProvider imports it directly and the two clients cannot drift on color.
 */

/** 4 / 8 / 12 / 16 / 24 / 32 / 40 — the app's single spacing family. */
export const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	"2xl": 32,
	"3xl": 40,
} as const;

export const radius = {
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	pill: 999,
} as const;

/*
 * No custom fonts: the app ships none (expo-font is installed but never
 * called), so it renders in the platform UI font. The web equivalent is the
 * system stack, which keeps the portal looking native beside the app on a Mac.
 */
export const fontStack =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const monoStack =
	'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

export type TypeToken = {
	size: number;
	lineHeight: number;
	weight: number;
	tracking?: number;
	/** Rendered uppercase — section eyebrows. */
	uppercase?: boolean;
};

/*
 * `maxFontSizeMultiplier` from the RN scale is dropped: it caps Dynamic Type,
 * which browsers do not have. Browser zoom scales everything together instead.
 */
export const type = {
	display: { size: 28, lineHeight: 34, weight: 700, tracking: -0.4 },
	title: { size: 22, lineHeight: 28, weight: 700, tracking: -0.3 },
	heading: { size: 17, lineHeight: 22, weight: 600, tracking: -0.2 },
	body: { size: 15, lineHeight: 21, weight: 400 },
	bodyStrong: { size: 15, lineHeight: 21, weight: 600 },
	label: { size: 13, lineHeight: 17, weight: 600 },
	caption: { size: 12, lineHeight: 16, weight: 400 },
	overline: {
		size: 12,
		lineHeight: 16,
		weight: 600,
		tracking: 0.6,
		uppercase: true,
	},
} as const satisfies Record<string, TypeToken>;

export type TypeVariant = keyof typeof type;

export const motion = {
	fast: 120,
	base: 200,
	slow: 320,
} as const;

/*
 * Minimum size for a PRIMARY control. The app applies 44 to everything
 * touchable; the portal keeps it for buttons and inputs but deliberately drops
 * table rows to 28–36px. A mouse does not need a thumb-sized target, and that
 * difference is most of what makes a dense table readable.
 */
export const hitTarget = 44;
export const rowHeight = { compact: 28, cozy: 36, comfortable: 44 } as const;

export const iconSize = {
	xs: 14,
	sm: 18,
	md: 22,
	lg: 26,
	xl: 32,
} as const;

/** Sidebar geometry. */
export const shell = {
	sidebarWidth: 220,
	sidebarCollapsedWidth: 56,
	topbarHeight: 52,
	drawerWidth: 420,
} as const;

/**
 * The static half of the token set, emitted once into a <style> tag at boot.
 * Colors are not here — they change with the theme and are set as inline
 * custom properties on <html> instead.
 */
export function staticTokenCss(): string {
	const lines: string[] = [];

	for (const [key, value] of Object.entries(spacing)) {
		lines.push(`--sp-${key}: ${value}px;`);
	}
	for (const [key, value] of Object.entries(radius)) {
		lines.push(`--r-${key}: ${value}px;`);
	}
	for (const [key, token] of Object.entries(type)) {
		const t = token as TypeToken;
		const name = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
		lines.push(
			`--t-${name}: ${t.weight} ${t.size}px/${t.lineHeight}px ${fontStack};`,
		);
		lines.push(`--tt-${name}: ${t.tracking ?? 0}px;`);
	}
	for (const [key, value] of Object.entries(motion)) {
		lines.push(`--motion-${key}: ${value}ms;`);
	}
	for (const [key, value] of Object.entries(iconSize)) {
		lines.push(`--icon-${key}: ${value}px;`);
	}
	for (const [key, value] of Object.entries(rowHeight)) {
		lines.push(`--row-${key}: ${value}px;`);
	}

	lines.push(`--hit-target: ${hitTarget}px;`);
	lines.push(`--font-stack: ${fontStack};`);
	lines.push(`--font-mono: ${monoStack};`);
	lines.push(`--sidebar-w: ${shell.sidebarWidth}px;`);
	lines.push(`--sidebar-collapsed-w: ${shell.sidebarCollapsedWidth}px;`);
	lines.push(`--topbar-h: ${shell.topbarHeight}px;`);
	lines.push(`--drawer-w: ${shell.drawerWidth}px;`);

	/*
	 * Elevation. The app's design "leans on hairlines, not shadows" — these two
	 * are reserved for things that genuinely float. color-mix carries the
	 * theme's --c-shadow at the RN opacities (0.08 / 0.14).
	 */
	lines.push(
		`--e-raised: 0 2px 8px color-mix(in srgb, var(--c-shadow) 8%, transparent);`,
	);
	lines.push(
		`--e-floating: 0 6px 16px color-mix(in srgb, var(--c-shadow) 14%, transparent);`,
	);

	return `:root {\n\t${lines.join("\n\t")}\n}`;
}
