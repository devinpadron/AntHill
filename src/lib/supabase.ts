import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

/**
 * Single Supabase client for the app. Replaces the Firestore singleton at
 * src/constants/firestore.js once the service adapter cutover lands.
 *
 * Config comes from app.config.js `extra` (SUPABASE_URL / SUPABASE_ANON_KEY),
 * which read from env at build time. The anon key is safe on the client — RLS
 * is the security boundary.
 *
 * Auth sessions persist in AsyncStorage and auto-refresh. `detectSessionInUrl`
 * is off (no deep-link OAuth callback handling on mobile yet).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
	SUPABASE_URL?: string;
	SUPABASE_ANON_KEY?: string;
};

const supabaseUrl = extra.SUPABASE_URL ?? "";
const supabaseAnonKey = extra.SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
	console.warn(
		"[supabase] Missing config — set SUPABASE_URL and SUPABASE_ANON_KEY in the environment.",
	);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		storage: AsyncStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: false,
	},
});
