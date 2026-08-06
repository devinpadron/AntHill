/*
 * Sets the minimum app version — the force-update lever.
 *
 *   node src/set-required-version.mjs --db=prod --version=1.1.1 --apply --confirm=FORCE_UPDATE
 *   node src/set-required-version.mjs --db=prod --version=1.0.100 --apply --confirm=FORCE_UPDATE
 *
 * Writes AppData/Data.required_version, which every client compares against its
 * own build. Anything older is put behind a blocking "Update Required" screen.
 *
 * TWO WAYS TO GET THIS BADLY WRONG, both guarded below:
 *
 *   1. Naming a version that is not ACTUALLY DOWNLOADABLE yet. Everyone below
 *      it is locked out and sent to the App Store, where there is nothing to
 *      get. Approved is not the same as released.
 *
 *   2. Raising it BEFORE activeVersion moves. The new build declares schema 2;
 *      if the server still says 1 it gates itself, so forcing everyone onto it
 *      locks out the entire user base. Order is: activeVersion first, then this.
 *
 * The second is checked here, because it is cheap to check and expensive to
 * discover. The first cannot be checked from a script — it is on you.
 */
import { db, parseArgs } from "./admin.mjs";

const argv = process.argv.slice(2);
const args = parseArgs(argv);

const versionArg = argv.find((a) => a.startsWith("--version="));
const confirmArg = argv.find((a) => a.startsWith("--confirm="));
const version = versionArg ? versionArg.slice(10).trim() : "";
const confirm = confirmArg ? confirmArg.slice(10) : "";

if (!/^\d+\.\d+\.\d+$/.test(version)) {
	console.error("Pass --version=X.Y.Z, e.g. --version=1.1.1");
	process.exit(1);
}

/** The schema versions each app line speaks. 1.1.x is the v2 line. */
const schemaForVersion = (v) => (Number(v.split(".")[1]) >= 1 ? 2 : 1);

for (const target of args.targets) {
	if (target === "prod" && confirm !== "FORCE_UPDATE") {
		console.error(
			`\nRefusing to set PRODUCTION required_version to ${version}.`,
			"\nEveryone on an older build is locked out until they update.",
			"\nRe-run with --confirm=FORCE_UPDATE once that build is RELEASED,",
			"\nnot merely approved.\n",
		);
		process.exit(1);
	}

	const firestore = db(target);
	const appData = firestore.collection("AppData").doc("Data");
	const schemaRef = firestore.collection("appConfig").doc("schema");

	const [before, config] = await Promise.all([
		appData.get(),
		schemaRef.get(),
	]);

	const activeVersion = config.data()?.activeVersion;
	const needs = schemaForVersion(version);

	console.log(
		`[${target}] required_version ${before.data()?.required_version} -> ${version}`,
	);
	console.log(
		`[${target}] that build speaks schema ${needs}; server activeVersion is ${activeVersion}`,
	);

	if (activeVersion !== undefined && needs !== activeVersion) {
		console.error(
			`\n[${target}] REFUSING. Forcing everyone onto ${version} while the server`,
			`\nis on activeVersion ${activeVersion} locks out the entire user base — that`,
			`\nbuild would gate ITSELF on arrival.`,
			`\n\nSet activeVersion to ${needs} first:`,
			`\n  node src/set-schema-version.mjs --db=${target} --version=${needs} --apply` +
				(target === "prod" ? " --confirm=CUTOVER" : "") +
				"\n",
		);
		process.exit(1);
	}

	if (!args.apply) {
		console.log(`[${target}] DRY RUN — nothing written.`);
		continue;
	}

	await appData.set({ required_version: version }, { merge: true });
	console.log(`[${target}] written.`);
}

if (!args.apply) console.log("\nRe-run with --apply to commit.");

process.exit(0);
