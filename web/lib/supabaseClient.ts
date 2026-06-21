import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for the admin console. The console is a client-side
 * SPA (desktop, behind login), so a browser client with localStorage sessions
 * is sufficient — no SSR cookie handling. RLS is the security boundary; the
 * anon key is safe to ship.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(url, anonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});
