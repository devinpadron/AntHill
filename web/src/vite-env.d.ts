/// <reference types="vite/client" />

/**
 * Defined by `define` in vite.config.ts, driven by VITE_ANTHILL_DB.
 *
 * ../src/constants/database.ts — shared with the mobile app and not modified —
 * reads this to choose between the "test" and "(default)" Firestore databases.
 */
declare const __DEV__: boolean;

/**
 * When this bundle was built (HH:MM:SS). Shown on /diagnostics so a stale
 * browser module is distinguishable from a real failure.
 */
declare const __BUILD_STAMP__: string;

interface ImportMetaEnv {
	readonly VITE_FB_API_KEY: string;
	readonly VITE_FB_AUTH_DOMAIN: string;
	readonly VITE_FB_PROJECT_ID: string;
	readonly VITE_FB_STORAGE_BUCKET: string;
	readonly VITE_FB_SENDER_ID: string;
	readonly VITE_FB_APP_ID: string;
	/** "test" (default) or "default" — which Firestore database to talk to. */
	readonly VITE_ANTHILL_DB?: string;
	/** Browser-restricted Maps JS key. Separate from the mobile Places key. */
	readonly VITE_GOOGLE_MAPS_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
