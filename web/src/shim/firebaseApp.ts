import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

/*
 * The single FirebaseApp for the portal.
 *
 * Everything else in src/shim/ resolves its service off this one instance —
 * two apps would mean two auth states, and the Firestore handle would be
 * authenticated as nobody.
 *
 * Config comes from VITE_FB_* in web/.env.*, which `firebase apps:sdkconfig
 * WEB` generates. These values are public by design: a web Firebase config is
 * shipped to every browser, and access is controlled by firestore.rules, not
 * by hiding the project id.
 */
const config = {
	apiKey: import.meta.env.VITE_FB_API_KEY,
	authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FB_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
	appId: import.meta.env.VITE_FB_APP_ID,
};

if (!config.projectId) {
	// Failing loudly here beats a hundred permission-denied errors later.
	throw new Error(
		"Firebase config is missing. Copy web/.env.example to web/.env.local " +
			"and fill it from `firebase apps:sdkconfig WEB`.",
	);
}

export const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
