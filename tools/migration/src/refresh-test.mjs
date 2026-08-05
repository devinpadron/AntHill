/*
 * Replaces the contents of the `test` database with a copy of production.
 *
 *   node src/refresh-test.mjs            # dry run
 *   node src/refresh-test.mjs --apply    # wipe test, then copy
 *
 * WHY THIS EXISTS
 *
 * The cutover rehearsal has to run against data that looks like production. A
 * `test` database that has drifted for weeks proves nothing about the shapes
 * that actually exist — so this is run immediately BEFORE a rehearsal, never
 * long in advance.
 *
 * The canonical approach is `gcloud firestore export` + `import`, which also
 * gives you a restorable backup. This is the pragmatic substitute at ~13k
 * documents; for the real pre-cutover backup, use the gcloud export.
 *
 * SAFETY
 *
 * The destination is hard-locked to `test`. Production is opened read-only and
 * the writer asserts its own database id before the first write — a copy script
 * pointed the wrong way would be unrecoverable, so the guard is not optional.
 */
import { db, DATABASES, parseArgs } from "./admin.mjs";

const SOURCE = "prod";
const DESTINATION = "test";

const args = parseArgs();
const apply = args.apply;

const source = db(SOURCE);
const destination = db(DESTINATION);

/*
 * Never rely on a constant alone. If the admin helper is ever changed so that
 * "test" resolves elsewhere, this stops the run rather than overwriting it.
 */
const destId = destination._settings?.databaseId ?? DATABASES[DESTINATION];
if (destId !== "test") {
	console.error(
		`REFUSING TO RUN: destination resolved to "${destId}", not "test".`,
	);
	process.exit(1);
}
if (DATABASES[SOURCE] === DATABASES[DESTINATION]) {
	console.error("REFUSING TO RUN: source and destination are the same.");
	process.exit(1);
}

/*
 * Every document under a collection, including nested subcollections.
 *
 * listCollections() is one round trip PER DOCUMENT, so serially over ~13k
 * documents this takes many minutes. The probes are therefore issued in
 * parallel batches.
 *
 * An earlier version sampled the first few documents of a collection and
 * skipped probing the rest if none had subcollections. That LOST DATA: a
 * company whose first five events happened to have no attachments had all its
 * remaining events skipped, dropping 13 attachment records. For a tool whose
 * whole purpose is fidelity, sampling is the wrong trade — every document is
 * probed.
 */
const PARALLEL = 100;

async function collectDocs(collectionRef, parentPath = []) {
	const snapshot = await collectionRef.get();
	if (snapshot.empty) return [];

	const basePath = [...parentPath, collectionRef.id];
	const docs = snapshot.docs.map((doc) => ({
		path: [...basePath, doc.id],
		data: doc.data(),
		ref: doc.ref,
	}));

	const out = docs.map(({ path, data }) => ({ path, data }));

	for (let i = 0; i < docs.length; i += PARALLEL) {
		const chunk = docs.slice(i, i + PARALLEL);
		const subLists = await Promise.all(
			chunk.map((d) => d.ref.listCollections()),
		);
		const nested = await Promise.all(
			subLists.flatMap((subs, j) =>
				subs.map((sub) =>
					collectDocs(
						sub,
						chunk[j].path
							.slice(0, -1)
							.concat(chunk[j].path.slice(-1)),
					),
				),
			),
		);
		for (const group of nested) out.push(...group);
	}

	return out;
}

/** ["events", "abc"] -> destination.collection("events").doc("abc") */
function refFor(firestore, segments) {
	let ref = firestore.collection(segments[0]);
	for (let i = 1; i < segments.length; i += 1) {
		ref = i % 2 === 1 ? ref.doc(segments[i]) : ref.collection(segments[i]);
	}
	return ref;
}

console.log(`Refreshing "${DESTINATION}" from "${SOURCE}"\n`);

// ------------------------------------------------------------- read source
const sourceCollections = await source.listCollections();
const documents = (
	await Promise.all(sourceCollections.map((c) => collectDocs(c)))
).flat();

const byCollection = {};
for (const doc of documents) {
	const key = doc.path.filter((_, i) => i % 2 === 0).join("/*/");
	byCollection[key] = (byCollection[key] ?? 0) + 1;
}

console.log("=== WILL COPY ===");
for (const [name, count] of Object.entries(byCollection).sort()) {
	console.log(`  ${name.padEnd(34)} ${count}`);
}
console.log(`  ${"TOTAL".padEnd(34)} ${documents.length}\n`);

// -------------------------------------------------------- inspect existing
const destCollections = await destination.listCollections();
const existing = (
	await Promise.all(destCollections.map((c) => collectDocs(c)))
).flat();

console.log(`=== WILL DELETE FROM "${DESTINATION}" ===`);
console.log(`  ${existing.length} existing documents\n`);

if (!apply) {
	console.log("DRY RUN — nothing written. Re-run with --apply to commit.");
	console.log(
		"NOTE: this DISCARDS anything created in test while testing —\n" +
			"      clock-ins, uploads, events. That is the point, but it is\n" +
			"      worth knowing before you run it.",
	);
	process.exit(0);
}

// ------------------------------------------------------------------- wipe
console.log(`Deleting ${existing.length} documents from "${DESTINATION}"...`);
let writer = destination.bulkWriter();
writer.onWriteError((error) => error.failedAttempts < 5);

// Deepest first, so a parent is never removed before its subcollections.
for (const doc of [...existing].sort((a, b) => b.path.length - a.path.length)) {
	writer.delete(refFor(destination, doc.path));
}
await writer.close();

// ------------------------------------------------------------------- copy
console.log(`Copying ${documents.length} documents...`);
writer = destination.bulkWriter();
writer.onWriteError((error) => error.failedAttempts < 5);

for (const doc of documents) {
	writer.set(refFor(destination, doc.path), doc.data);
}
await writer.close();

console.log(`\nDone. "${DESTINATION}" now mirrors "${SOURCE}".`);
console.log(
	"Storage is a single shared bucket, so attachment URLs still resolve.",
);
process.exit(0);
