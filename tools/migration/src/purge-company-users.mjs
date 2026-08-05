/*
 * Cleans up user records left behind by a DELETED company.
 *
 *   node src/purge-company-users.mjs --company=ADMCreative --db=prod
 *   node src/purge-company-users.mjs --company=ADMCreative --db=prod --apply
 *
 * Two distinct actions, decided per user:
 *
 *   PRUNE   the company is one of several -> remove just the stale
 *           companies[] entry. The account is left completely alone.
 *   DELETE  the company is the user's ONLY one -> the account is dead.
 *           Removes the Firestore document AND the Auth account.
 *
 * Deleting the Firestore document without the Auth account would strand the
 * user in a crash loop: they could still sign in, and useAuth.ts reads
 * `userData.email` off the resulting null. So the two always go together.
 *
 * Safety:
 *   - dry run unless --apply
 *   - refuses to run while the company document still exists
 *   - writes a full JSON backup of everything it touches BEFORE deleting
 *   - never deletes a user who belongs to any surviving company
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { db, initAdmin, parseArgs } from "./admin.mjs";

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const companyArg = argv.find((a) => a.startsWith("--company="));

if (!companyArg) {
	console.error("Missing --company=<companyId>");
	process.exit(1);
}

const companyId = companyArg.slice("--company=".length);
const target = args.targets[0];
const firestore = db(target);

// Guard: this script is only for companies that no longer exist.
const companyDoc = await firestore.collection("Companies").doc(companyId).get();
if (companyDoc.exists) {
	console.error(
		`Refusing to run: Companies/${companyId} still exists in "${target}".\n` +
			`This script is only for cleaning up after a DELETED company.`,
	);
	process.exit(1);
}

const usersSnap = await firestore.collection("Users").get();

const toDelete = [];
const toPrune = [];

for (const user of usersSnap.docs) {
	const data = user.data() ?? {};
	const companies = Array.isArray(data.companies) ? data.companies : [];
	if (!companies.includes(companyId)) continue;

	const remaining = companies.filter((c) => c !== companyId);
	const record = { id: user.id, email: data.email, data };

	if (remaining.length === 0) {
		toDelete.push(record);
	} else {
		toPrune.push({ ...record, remaining });
	}
}

console.log(`Company "${companyId}" in "${target}" — company doc: DELETED\n`);
console.log(`DELETE (only company was ${companyId}): ${toDelete.length}`);
for (const u of toDelete) console.log(`   ${u.id}  ${u.email}`);
console.log(`\nPRUNE (belongs to other companies too): ${toPrune.length}`);
for (const u of toPrune) {
	console.log(`   ${u.id}  ${u.email}  -> keeps [${u.remaining.join(", ")}]`);
}
console.log("");

if (!args.apply) {
	console.log("DRY RUN — nothing written. Re-run with --apply to commit.");
	process.exit(0);
}

// Back up everything we are about to touch, before touching it.
const reportsDir = new URL("../reports/", import.meta.url).pathname;
mkdirSync(reportsDir, { recursive: true });
const backupPath = `${reportsDir}purge-${companyId}-${Date.now()}.json`;
writeFileSync(
	backupPath,
	JSON.stringify({ companyId, target, toDelete, toPrune }, null, 2),
);
console.log(`Backup written to ${backupPath}\n`);

const auth = getAuth(initAdmin());

for (const user of toPrune) {
	await firestore
		.collection("Users")
		.doc(user.id)
		.update({ companies: FieldValue.arrayRemove(companyId) });
	console.log(`PRUNED  ${user.id} (${user.email})`);
}

for (const user of toDelete) {
	await firestore.collection("Users").doc(user.id).delete();

	try {
		await auth.deleteUser(user.id);
		console.log(`DELETED ${user.id} (${user.email}) — Firestore + Auth`);
	} catch (e) {
		// The Firestore doc is already gone; an absent Auth record is fine.
		const detail = e?.code === "auth/user-not-found" ? "no Auth record" : e;
		console.log(
			`DELETED ${user.id} (${user.email}) — Firestore only, ${detail}`,
		);
	}
}

console.log(`\nDone. ${toDelete.length} deleted, ${toPrune.length} pruned.`);
process.exit(0);
