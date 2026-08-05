/*
 * Flips appConfig/schema.activeVersion — the cutover switch, and the rollback.
 *
 *   node src/set-schema-version.mjs --db=test --version=2 --apply
 *   node src/set-schema-version.mjs --db=prod --version=2 --apply --confirm=CUTOVER
 *   node src/set-schema-version.mjs --db=prod --version=1 --apply --confirm=ROLLBACK
 *
 * Clients gate themselves on this value against their own
 * SUPPORTED_SCHEMA_VERSIONS. Setting it to 2 is what lets an approved v2 build
 * out of the update screen; setting it back to 1 is what puts it back, which is
 * the whole rollback story before the point of no return.
 *
 * PRODUCTION REQUIRES --confirm. Flipping prod is not a step you should be able
 * to take by editing a flag in shell history — going forward it releases every
 * v2 client at once, and going back strands every write those clients made in
 * the meantime.
 *
 * Rules deny all client writes to appConfig, so this needs admin credentials.
 * That is deliberate: no client should be able to release itself.
 */
import { db, parseArgs } from "./admin.mjs";

const argv = process.argv.slice(2);
const args = parseArgs(argv);

const versionArg = argv.find((a) => a.startsWith("--version="));
const confirmArg = argv.find((a) => a.startsWith("--confirm="));
const version = versionArg ? Number(versionArg.slice(10)) : NaN;
const confirm = confirmArg ? confirmArg.slice(10) : "";

if (![1, 2].includes(version)) {
	console.error("Pass --version=1 or --version=2.");
	process.exit(1);
}

const EXPECTED_CONFIRM = { 1: "ROLLBACK", 2: "CUTOVER" };

for (const target of args.targets) {
	if (target === "prod" && confirm !== EXPECTED_CONFIRM[version]) {
		console.error(
			`\nRefusing to set PRODUCTION to activeVersion ${version}.`,
			`\nRe-run with --confirm=${EXPECTED_CONFIRM[version]} if that is really what you mean.\n`,
		);
		process.exit(1);
	}

	const firestore = db(target);
	const ref = firestore.collection("appConfig").doc("schema");
	const before = (await ref.get()).data() ?? {};

	console.log(
		`[${target}] activeVersion ${before.activeVersion} -> ${version}`,
	);
	if (before.maintenance) {
		console.log(
			`[${target}] NOTE: maintenance is ON — clients are frozen.`,
		);
	}

	if (!args.apply) {
		console.log(`[${target}] DRY RUN — nothing written.`);
		continue;
	}

	// merge, so a maintenance flag set by hand during the window survives.
	await ref.set({ activeVersion: version }, { merge: true });
	console.log(`[${target}] written.`);
}

if (!args.apply) {
	console.log("\nRe-run with --apply to commit.");
}

process.exit(0);
