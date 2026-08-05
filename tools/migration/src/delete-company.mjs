/*
 * Deletes a company and everything under it.
 *
 *   node src/delete-company.mjs --company=VincenzoSalvatoreCakes --db=prod
 *   node src/delete-company.mjs --company=VincenzoSalvatoreCakes --db=prod --apply
 *
 * Firestore does NOT cascade: deleting a company document leaves every
 * subcollection behind as invisible orphaned data that a later migration would
 * happily sweep up. This walks the subcollections explicitly.
 *
 * Safety:
 *   - dry run unless --apply
 *   - refuses to run if any user still references the company, so nobody is
 *     stranded the way the ADMCreative users were
 *   - backs up every document it will delete BEFORE deleting
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { db, parseArgs } from "./admin.mjs";

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

const companyRef = firestore.collection("Companies").doc(companyId);
const companyDoc = await companyRef.get();

if (!companyDoc.exists) {
	console.log(`Companies/${companyId} does not exist in "${target}".`);
	process.exit(0);
}

// Refuse if anyone still belongs to it.
const usersSnap = await firestore.collection("Users").get();
const referencing = usersSnap.docs.filter((u) => {
	const companies = u.data()?.companies;
	return Array.isArray(companies) && companies.includes(companyId);
});

if (referencing.length > 0) {
	console.error(
		`Refusing to run: ${referencing.length} user(s) still list "${companyId}".\n` +
			referencing
				.map((u) => `   ${u.id}  ${u.data()?.email}`)
				.join("\n") +
			`\n\nRun purge-company-users.mjs first, or remove the references.`,
	);
	process.exit(1);
}

// Walk everything beneath the company document.
const backup = {
	companyId,
	target,
	company: companyDoc.data(),
	subcollections: {},
};
const toDelete = [];
let docCount = 0;

async function walk(ref, label) {
	for (const collection of await ref.listCollections()) {
		const snap = await collection.get();
		const path = `${label}/${collection.id}`;
		backup.subcollections[path] = backup.subcollections[path] ?? [];

		for (const doc of snap.docs) {
			backup.subcollections[path].push({ id: doc.id, data: doc.data() });
			toDelete.push(doc.ref);
			docCount += 1;
			await walk(doc.ref, `${path}/${doc.id}`);
		}
	}
}

await walk(companyRef, companyId);

console.log(
	`Company "${companyId}" (${companyDoc.data()?.name}) in "${target}"`,
);
console.log(`Users still referencing it: 0`);
console.log(`Subcollection documents found: ${docCount}`);
for (const [path, docs] of Object.entries(backup.subcollections)) {
	if (docs.length) console.log(`   ${path}: ${docs.length}`);
}
console.log("");

if (!args.apply) {
	console.log("DRY RUN — nothing deleted. Re-run with --apply to commit.");
	process.exit(0);
}

const dir = new URL("../reports/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const path = `${dir}deleted-company-${companyId}-${Date.now()}.json`;
writeFileSync(path, JSON.stringify(backup, null, 2));
console.log(`Backup written to ${path}\n`);

// Deepest documents first, then the company document itself.
for (const ref of toDelete.reverse()) await ref.delete();
await companyRef.delete();

console.log(
	`Deleted ${docCount} subcollection document(s) + the company document.`,
);
process.exit(0);
