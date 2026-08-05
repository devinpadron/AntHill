import db from "../lib/db";
import { APP_CONFIG, APP_DATA } from "../constants/paths";
import { FALLBACK_ACTIVE_SCHEMA_VERSION } from "../constants/schema";

/* Remote app-level configuration. Read before auth, so the security rules must
 * allow unauthenticated reads of `AppData/Data` and `appConfig/schema`. */
export type AppConfigSchema = {
	activeVersion: number;
	maintenance: boolean;
	message: string;
};

/* Every read below fails OPEN: a Firestore outage must never gate users out of
 * the app. The gate only ever engages on a value we successfully read. */
export const FALLBACK_APP_CONFIG: AppConfigSchema = {
	activeVersion: FALLBACK_ACTIVE_SCHEMA_VERSION,
	maintenance: false,
	message: "",
};

/**
 * Reads the minimum app version clients must be on.
 * Returns null when unknown, which callers treat as "no update required".
 */
export async function getRequiredVersion(): Promise<string | null> {
	try {
		const snapshot = await db
			.collection(APP_DATA.collection)
			.doc(APP_DATA.doc)
			.get();
		const required = snapshot.data()?.required_version;
		return typeof required === "string" ? required : null;
	} catch (e) {
		console.error("Error getting required version", e);
		return null;
	}
}

/**
 * Reads the maintenance flag and the active schema version.
 * Missing or malformed fields fall back to the permissive defaults.
 */
export async function getAppConfig(): Promise<AppConfigSchema> {
	try {
		const snapshot = await db
			.collection(APP_CONFIG.collection)
			.doc(APP_CONFIG.doc)
			.get();
		if (!snapshot.exists()) {
			return FALLBACK_APP_CONFIG;
		}

		const data = snapshot.data();
		return {
			activeVersion:
				typeof data?.activeVersion === "number"
					? data.activeVersion
					: FALLBACK_APP_CONFIG.activeVersion,
			maintenance: data?.maintenance === true,
			message: typeof data?.message === "string" ? data.message : "",
		};
	} catch (e) {
		console.error("Error getting app config", e);
		return FALLBACK_APP_CONFIG;
	}
}
