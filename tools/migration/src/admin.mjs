import { existsSync } from "node:fs";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const PROJECT_ID = "anthill-51de0";

/** The two Firestore databases. `test` is what __DEV__ builds talk to. */
export const DATABASES = {
	prod: "(default)",
	test: "test",
};

let app;

/**
 * Admin credentials, in order of preference:
 *   1. GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account JSON
 *   2. tools/migration/service-account.json  (gitignored)
 *   3. Application Default Credentials (gcloud auth application-default login)
 *
 * `firebase login` does NOT provide credentials the Admin SDK can use — it
 * writes CLI-only tokens. A service-account key is the path of least friction.
 */
/** Places a service-account key is accepted, in priority order. */
function candidateKeyPaths() {
	const rel = (p) => new URL(p, import.meta.url).pathname;
	return [
		process.env.GOOGLE_APPLICATION_CREDENTIALS,
		rel("../service-account.json"), // tools/migration/
		rel("../../service-account.json"), // tools/
		rel("../../../service-account.json"), // repo root
	].filter(Boolean);
}

export function initAdmin() {
	if (app) return app;

	const checked = candidateKeyPaths();
	const keyPath = checked.find((p) => existsSync(p));

	if (keyPath) {
		app = initializeApp({
			projectId: PROJECT_ID,
			credential: cert(keyPath),
		});
		return app;
	}

	// NOTE: applicationDefault() does NOT throw here — it only fails later, when
	// the credential is first used, with an opaque "Could not load the default
	// credentials". So probe for ADC explicitly rather than falling through and
	// letting that surface at query time.
	if (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT) {
		app = initializeApp({
			projectId: PROJECT_ID,
			credential: applicationDefault(),
		});
		return app;
	}

	throw new Error(
		[
			"No admin credentials found.",
			"",
			"Firebase console -> Project settings -> Service accounts",
			"-> Generate new private key, then save the JSON to any of:",
			...checked.map((p) => `  ${p}`),
			"",
			"That filename is gitignored. Never commit it.",
		].join("\n"),
	);
}

const announced = new Set();

/*
 * Announce the target ONCE per process, loudly for production.
 *
 * `test` is now a full copy of production, so no output distinguishes them —
 * counts, ids and names are identical. The only difference is one character in
 * the flag, and getting it wrong on a --apply run is not recoverable.
 */
function announce(which, databaseId) {
	if (announced.has(which)) return;
	announced.add(which);

	const red = "\x1b[41m\x1b[97m\x1b[1m";
	const green = "\x1b[42m\x1b[30m";
	const reset = "\x1b[0m";

	if (which === "prod") {
		console.log(
			`${red}  PRODUCTION DATABASE  ${reset} Firestore "${databaseId}" — real company data\n`,
		);
	} else {
		console.log(
			`${green}  TEST DATABASE  ${reset} Firestore "${databaseId}"\n`,
		);
	}
}

/** @param {"prod"|"test"} which */
export function db(which) {
	const databaseId = DATABASES[which];
	if (!databaseId) {
		throw new Error(`Unknown database "${which}" — use "prod" or "test".`);
	}
	announce(which, databaseId);
	return getFirestore(initAdmin(), databaseId);
}

/**
 * Parses `--db=prod`, `--apply`, etc.
 * Every script defaults to a DRY RUN; writing requires an explicit --apply.
 */
export function parseArgs(argv = process.argv.slice(2)) {
	const args = { targets: [], apply: false };

	for (const arg of argv) {
		if (arg === "--apply") args.apply = true;
		else if (arg.startsWith("--db=")) {
			const value = arg.slice(5);
			args.targets = value === "both" ? ["prod", "test"] : [value];
		}
	}

	/*
	 * Defaults to `test`. Deliberately the safe one — a forgotten flag should
	 * never land on production — and every tool announces which it got, so a
	 * default that is not what you meant is visible immediately.
	 */
	if (args.targets.length === 0) args.targets = ["test"];
	return args;
}
