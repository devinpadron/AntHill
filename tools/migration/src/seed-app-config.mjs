/*
 * Seeds appConfig/schema — the document the launch gate reads.
 *
 *   node src/seed-app-config.mjs --db=both            # dry run
 *   node src/seed-app-config.mjs --db=both --apply    # write
 *
 * Security rules deny ALL client writes to appConfig, so this has to run with
 * admin credentials. That is deliberate: the maintenance flag is what freezes
 * writes during the migration cutover, and no client should be able to touch it.
 *
 * Uses merge:true so re-running never clobbers a maintenance flag you have
 * deliberately set.
 */
import { db, parseArgs } from "./admin.mjs";

const SEED = {
	activeVersion: 1,
	maintenance: false,
	message: "",
};

const args = parseArgs();

for (const target of args.targets) {
	const firestore = db(target);
	const ref = firestore.collection("appConfig").doc("schema");
	const existing = await ref.get();

	if (existing.exists) {
		console.log(`[${target}] appConfig/schema already exists:`);
		console.log(`         ${JSON.stringify(existing.data())}`);
		console.log(`[${target}] leaving it alone.`);
		continue;
	}

	if (!args.apply) {
		console.log(`[${target}] DRY RUN — would create appConfig/schema:`);
		console.log(`         ${JSON.stringify(SEED)}`);
		continue;
	}

	await ref.set(SEED, { merge: true });
	console.log(`[${target}] created appConfig/schema ${JSON.stringify(SEED)}`);
}

if (!args.apply) {
	console.log("\nNothing was written. Re-run with --apply to commit.");
}

process.exit(0);
