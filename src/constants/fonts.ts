/**
 * Font assets and loader map for expo-font.
 *
 * Keys here must match `FontFamily` in tokens.ts so the design system can
 * reference fonts by semantic role (display / ui / mono) without screens
 * knowing about specific files.
 */

export const fontAssets = {
	InstrumentSerif: require("../assets/fonts/InstrumentSerif-Regular.ttf"),
	"InstrumentSerif-Italic": require("../assets/fonts/InstrumentSerif-Italic.ttf"),

	Geist: require("../assets/fonts/Geist-Regular.ttf"),
	"Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
	"Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.ttf"),
	"Geist-Bold": require("../assets/fonts/Geist-Bold.ttf"),

	GeistMono: require("../assets/fonts/GeistMono-Regular.ttf"),
	"GeistMono-Medium": require("../assets/fonts/GeistMono-Medium.ttf"),
};

export type FontKey = keyof typeof fontAssets;

/**
 * Resolves a `FontFamily.*` token + weight to the actual font file key.
 * RN doesn't synthesize weights from a single family — each weight is its
 * own loaded file — so we map (family, weight) → asset key explicitly.
 */
export function resolveFont(
	family: "ui" | "display" | "displayItalic" | "mono",
	weight: "normal" | "medium" | "semibold" | "bold" = "normal",
): FontKey {
	if (family === "display") return "InstrumentSerif";
	if (family === "displayItalic") return "InstrumentSerif-Italic";
	if (family === "mono") {
		return weight === "medium" ? "GeistMono-Medium" : "GeistMono";
	}
	// ui (Geist)
	switch (weight) {
		case "medium":
			return "Geist-Medium";
		case "semibold":
			return "Geist-SemiBold";
		case "bold":
			return "Geist-Bold";
		default:
			return "Geist";
	}
}
