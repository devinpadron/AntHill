import { useEffect } from "react";
import * as NativeSplash from "expo-splash-screen";

/**
 * Releases the native launch screen, which `index.js` holds open.
 *
 * Call this from the outermost themed component of a tree — not from the splash
 * screen itself. `AppGate` renders before the splash does, so tying the reveal
 * to the splash would leave a blocked build (forced update, schema mismatch)
 * sitting invisible behind a launch screen that never lifts.
 *
 * Runs in an effect, so there is a painted frame underneath before the launch
 * screen goes; hiding any earlier is what produces the flash.
 */
export const useHideNativeSplash = () => {
	useEffect(() => {
		NativeSplash.hideAsync().catch(() => {});
	}, []);
};
