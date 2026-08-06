/*
 * Freezes and unfreezes the app.
 *
 *   node src/set-maintenance.mjs --db=prod --on  --apply --confirm=FREEZE
 *   node src/set-maintenance.mjs --db=prod --off --apply
 *   node src/set-maintenance.mjs --db=prod --on  --apply --confirm=FREEZE \
 *        --message="Back in about 20 minutes."
 *
 * `maintenance: true` puts every client behind a full-screen "AntHill is
 * updating" with a Try Again button. Nothing behind it mounts, so nothing
 * writes — which is the point: the migration has to run against a database
 * that is holding still.
 *
 * Turning it ON needs --confirm=FREEZE. Turning it OFF does not: getting people
 * back into the app should never be the harder of the two.
 *
 * Clients re-check on every foreground, so both directions take effect without
 * anyone reinstalling or force-quitting.
 */
import { db, parseArgs } from "./admin.mjs";

const argv = process.argv.slice(2);
const args = parseArgs(argv);

const on = argv.includes("--on");
const off = argv.includes("--off");
const confirmArg = argv.find((a) => a.startsWith("--confirm="));
const messageArg = argv.find((a) => a.startsWith("--message="));
const confirm = confirmArg ? confirmArg.slice(10) : "";
const message = messageArg ? messageArg.slice(10) : undefined;

if (on === off) {
	console.error("Pass exactly one of --on or --off.");
	process.exit(1);
}

for (const target of args.targets) {
	if (target === "prod" && on && confirm !== "FREEZE") {
		console.error(
			"\nRefusing to freeze PRODUCTION without --confirm=FREEZE.",
			"\nEvery user is locked out for as long as this is on.\n",
		);
		process.exit(1);
	}

	const firestore = db(target);
	const ref = firestore.collection("appConfig").doc("schema");
	const before = (await ref.get()).data() ?? {};

	console.log(
		`[${target}] maintenance ${before.maintenance === true} -> ${on}`,
	);
	if (message !== undefined) console.log(`[${target}] message: "${message}"`);
	if (before.activeVersion !== undefined) {
		console.log(`[${target}] activeVersion stays ${before.activeVersion}`);
	}

	if (!args.apply) {
		console.log(`[${target}] DRY RUN — nothing written.`);
		continue;
	}

	// merge, so activeVersion is never disturbed by a freeze.
	const patch = { maintenance: on };
	if (message !== undefined) patch.message = message;
	await ref.set(patch, { merge: true });
	console.log(`[${target}] written.`);
}

if (!args.apply) console.log("\nRe-run with --apply to commit.");

process.exit(0);
