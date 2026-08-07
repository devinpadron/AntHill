import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
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

/*
 * Both reads below go to the CACHE FIRST, then refresh in the background.
 *
 * These two are the first Firestore calls the app makes: useAppGate runs them
 * in a Promise.all before a single child mounts, so nothing renders until they
 * settle. A bare .get() does NOT fall straight through to the cache when there
 * is no signal — the client waits for its own online-state machine to give up,
 * roughly ten seconds on the first attempt after connectivity is lost. So a
 * cold launch in a basement showed a logo and a spinner for ten seconds and
 * then the app, which was the worst offline moment in the product.
 *
 * Reading the cache first turns that into an instant launch. The background
 * refresh means the next launch has current values, which is soon enough for
 * config that changes a few times a year.
 *
 * THE TRADE, stated because it touches the force-update lever: raising
 * required_version no longer stops a client on the very launch it is raised.
 * That launch reads the cached value and refreshes behind it, so the gate
 * engages on the next check. useAppGate re-runs on every return to foreground,
 * not just on cold start, so in practice that is the next time the user opens
 * the app rather than the next time they reinstall it. If a change ever needs
 * to land harder than that, force it on the SERVER path — do not make the whole
 * launch wait on the network again.
 */

/** Cache read, or null on a miss. A cache-only get REJECTS when nothing is stored. */
async function readCached(
	ref: FirebaseFirestoreTypes.DocumentReference,
): Promise<FirebaseFirestoreTypes.DocumentSnapshot | null> {
	try {
		const snapshot = await ref.get({ source: "cache" });
		return snapshot.exists() ? snapshot : null;
	} catch {
		return null;
	}
}

/** Warms the cache for next launch. Failure is expected offline and ignored. */
function revalidate(ref: FirebaseFirestoreTypes.DocumentReference): void {
	void ref.get({ source: "server" }).catch(() => {});
}

/**
 * Reads the minimum app version clients must be on.
 * Returns null when unknown, which callers treat as "no update required".
 */
export async function getRequiredVersion(): Promise<string | null> {
	const ref = db.collection(APP_DATA.collection).doc(APP_DATA.doc);

	try {
		const cached = await readCached(ref);
		if (cached) {
			revalidate(ref);
			const required = cached.data()?.required_version;
			return typeof required === "string" ? required : null;
		}

		// Never cached — a first launch. No choice but to wait for the network.
		const snapshot = await ref.get();
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
	const ref = db.collection(APP_CONFIG.collection).doc(APP_CONFIG.doc);

	const parse = (
		data: FirebaseFirestoreTypes.DocumentData | undefined,
	): AppConfigSchema => ({
		activeVersion:
			typeof data?.activeVersion === "number"
				? data.activeVersion
				: FALLBACK_APP_CONFIG.activeVersion,
		maintenance: data?.maintenance === true,
		message: typeof data?.message === "string" ? data.message : "",
	});

	try {
		const cached = await readCached(ref);
		if (cached) {
			revalidate(ref);
			return parse(cached.data());
		}

		const snapshot = await ref.get();
		if (!snapshot.exists()) {
			return FALLBACK_APP_CONFIG;
		}
		return parse(snapshot.data());
	} catch (e) {
		console.error("Error getting app config", e);
		return FALLBACK_APP_CONFIG;
	}
}
