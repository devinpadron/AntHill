import { useFonts } from "expo-font";
import { fontAssets } from "../constants/fonts";

/**
 * Loads the AntHill font stack (Instrument Serif + Geist + Geist Mono).
 *
 * Returns `[loaded, error]` from expo-font's useFonts hook. The root App
 * should keep the splash screen visible until `loaded` is true.
 */
export function useAppFonts() {
	return useFonts(fontAssets);
}
