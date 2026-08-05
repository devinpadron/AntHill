/*
 * Sweeps v1 documents that changed after the bulk migration ran.
 *
 *   node src/delta.mjs --db=prod                 # dry run
 *   node src/delta.mjs --db=prod --apply         # write
 *
 * WHY THIS EXISTS
 *
 * `migrate` is idempotent, so re-running it would also work — but it rewrites
 * every v2 document, and the Cloud Functions now trigger on v2 paths. A full
 * re-run would fire a push for all ~9,700 documents. This touches only what
 * actually changed.
 *
 * WHAT COUNTS AS CHANGED
 *
 * Three cases, all detected by comparing v1 against v2 rather than by trusting
 * a timestamp — v1 documents have no reliable updatedAt, so a time-based sweep
 * would miss edits to fields that do not stamp one:
 *
 *   NEW       in v1, absent from v2            -> migrate it
 *   DIVERGED  in both, but v2 no longer matches what the transform produces
 *             from the current v1 document     -> rewrite it
 *   DELETED   absent from v1, present in v2    -> reported, never auto-removed
 *
 * CONFLICTS
 *
 * A v2 document whose `updatedAt` is NEWER than its v1 counterpart's has been
 * edited by a v2 client since the cutover. Overwriting that would discard real
 * work, so those are reported and SKIPPED. Resolve them by hand.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { db, parseArgs } from "./admin.mjs";
import { timeZoneFor } from "./config.mjs";
import { C, membershipId } from "./paths.mjs";
import {
	transformChecklistState,
	transformEvent,
	transformEventResponses,
} from "./transform/event.mjs";
import {
	transformConnections,
	transformEdits,
	transformTimeEntry,
} from "./transform/timeEntry.mjs";
import { transformAttachment } from "./transform/attachment.mjs";
import {
	createSchemaRegistry,
	transformCompany,
	transformMembership,
	transformPreferences,
	transformUser,
} from "./transform/identity.mjs";
import {
	transformChecklist,
	transformEventLabel,
	transformPackage,
	transformUserSettings,
} from "./transform/library.mjs";

const args = parseArgs();
const target = args.targets[0];
const firestore = db(target);

/*
 * Fields the loader stamps or that are meaningless to compare. `updatedAt` is
 * excluded because a v2 client legitimately changes it without any v1 change.
 */
const IGNORED = new Set(["updatedAt", "createdAt", "schemaVersion"]);

/** Stable comparison that ignores key order and Timestamp identity. */
function normalize(value) {
	if (value === null || value === undefined) return null;
	if (typeof value?.toMillis === "function") return value.toMillis();
	if (value instanceof Date) return value.getTime();
	if (Array.isArray(value)) return value.map(normalize);
	if (typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.filter((k) => !IGNORED.has(k))
				.sort()
				.map((k) => [k, normalize(value[k])]),
		);
	}
	return value;
}

const differs = (a, b) =>
	JSON.stringify(normalize(a)) !== JSON.stringify(normalize(b));

const millis = (value) =>
	typeof value?.toMillis === "function" ? value.toMillis() : 0;

/* ------------------------------------------------------------- read v1 */

console.log(`Comparing v1 against v2 in "${target}"...\n`);

const usersSnap = await firestore.collection("Users").get();
const userDocs = new Map(usersSnap.docs.map((d) => [d.id, d.data() ?? {}]));
const userIds = new Set(userDocs.keys());

const displayNameFor = (uid) => {
	const u = userDocs.get(uid);
	if (!u) return null;
	return `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || u.email || null;
};

/** collection -> Map(id -> data) of what the transforms say v2 SHOULD contain. */
const expected = new Map();
const stage = (collection, id, data) => {
	if (!expected.has(collection)) expected.set(collection, new Map());
	expected.get(collection).set(id, data);
};

for (const [id, data] of userDocs) {
	stage(C.users, id, transformUser(id, data).doc);

	const settings = await firestore
		.collection("Users")
		.doc(id)
		.collection("Preferences")
		.doc("settings")
		.get();
	if (settings.exists) {
		stage(
			C.userSettings,
			id,
			transformUserSettings(id, settings.data()).doc,
		);
	}
}

const companiesSnap = await firestore.collection("Companies").get();

for (const company of companiesSnap.docs) {
	const companyId = company.id;
	const timeZone = timeZoneFor(companyId);
	const ctx = { companyId, timeZone };

	stage(
		C.companies,
		companyId,
		transformCompany(companyId, company.data() ?? {}, timeZone).doc,
	);

	const [
		members,
		events,
		timeEntries,
		packages,
		checklists,
		labels,
		settings,
	] = await Promise.all([
		company.ref.collection("Users").get(),
		company.ref.collection("Events").get(),
		company.ref.collection("TimeEntries").get(),
		company.ref.collection("Packages").get(),
		company.ref.collection("Checklists").get(),
		company.ref.collection("EventLabels").get(),
		company.ref.collection("Settings").doc("preferences").get(),
	]);

	const labelIds = new Set(labels.docs.map((d) => d.id));
	const packageIds = new Set(packages.docs.map((d) => d.id));
	const checklistIds = new Set(checklists.docs.map((d) => d.id));
	const eventIds = new Set(events.docs.map((d) => d.id));

	/*
	 * Schema versions are assigned by first-seen order, so the registry has to
	 * be rebuilt from the SAME inputs the bulk run used or ids would shift and
	 * every entry would look diverged.
	 */
	const registry = createSchemaRegistry(companyId);
	const schemaIdFor = (kind, schema) => registry.register(kind, schema);
	const prefs = settings.exists ? settings.data() : null;
	schemaIdFor("eventForm", prefs?.eventForm);
	schemaIdFor("timeEntryForm", prefs?.timeEntryForm);
	for (const t of timeEntries.docs) {
		const d = t.data() ?? {};
		schemaIdFor("eventForm", d.eventForm);
		schemaIdFor("timeEntryForm", d.generalForm);
	}
	for (const schema of registry.documents()) {
		stage(C.formSchemas, schema.id, schema);
	}

	stage(
		C.companyPreferences,
		companyId,
		transformPreferences(companyId, prefs, { schemaIdFor }).doc,
	);

	const membershipDocs = new Map(
		members.docs.map((d) => [d.id, d.data() ?? {}]),
	);
	const memberUserIds = new Set(membershipDocs.keys());
	for (const [uid, data] of userDocs) {
		if (
			Array.isArray(data.companies) &&
			data.companies.includes(companyId)
		) {
			memberUserIds.add(uid);
		}
	}
	for (const uid of memberUserIds) {
		stage(
			C.memberships,
			membershipId(companyId, uid),
			transformMembership({
				companyId,
				userId: uid,
				membershipDoc: membershipDocs.get(uid) ?? null,
				userDoc: userDocs.get(uid) ?? null,
			}).doc,
		);
	}

	for (const c of checklists.docs) {
		stage(
			C.checklists,
			c.id,
			transformChecklist(c.id, c.data() ?? {}, ctx).doc,
		);
	}
	for (const p of packages.docs) {
		stage(
			C.packages,
			p.id,
			transformPackage(p.id, p.data() ?? {}, { ...ctx, checklistIds })
				.doc,
		);
	}
	for (const l of labels.docs) {
		stage(
			C.eventLabels,
			l.id,
			transformEventLabel(l.id, l.data() ?? {}, ctx).doc,
		);
	}

	const packageChecklists = new Map(
		packages.docs.map((p) => [
			p.id,
			(p.data()?.checklists ?? [])
				.map((e) => (typeof e === "string" ? e : e?.checklistId))
				.filter(Boolean),
		]),
	);

	for (const e of events.docs) {
		const data = e.data() ?? {};
		const { doc } = transformEvent(e.id, data, {
			...ctx,
			labelIds,
			packageIds,
			userIds,
		});
		doc.checklistIds = [
			...new Set(
				doc.packageIds.flatMap((p) => packageChecklists.get(p) ?? []),
			),
		];

		const [atts, cls] = await Promise.all([
			e.ref.collection("Attachments").get(),
			e.ref.collection("Checklists").get(),
		]);
		doc.attachmentCount = atts.size;
		stage(C.events, e.id, doc);

		for (const r of transformEventResponses(e.id, data, ctx)) {
			stage(C.eventResponses, r.id, r);
		}

		const state = transformChecklistState(
			e.id,
			cls.docs.map((d) => ({ id: d.id, data: d.data() })),
			ctx,
		);
		if (state.doc) stage(C.eventChecklistStates, e.id, state.doc);

		for (const a of atts.docs) {
			const result = transformAttachment(a.id, a.data() ?? {}, {
				companyId,
				parentType: "event",
				parentId: e.id,
				ownerUserId: null,
			});
			if (result.doc) stage(C.attachments, result.doc.id, result.doc);
		}
	}

	for (const t of timeEntries.docs) {
		const data = t.data() ?? {};
		stage(
			C.timeEntries,
			t.id,
			transformTimeEntry(t.id, data, { ...ctx, schemaIdFor }).doc,
		);

		for (const c of transformConnections(t.id, data, { ...ctx, eventIds })
			.docs) {
			stage(`${C.timeEntries}/${t.id}/${C.connections}`, c.id, c);
		}
		for (const ed of transformEdits(t.id, data, { ...ctx, displayNameFor })
			.docs) {
			stage(`${C.timeEntries}/${t.id}/${C.edits}`, ed.id, ed);
		}

		for (const a of (await t.ref.collection("Attachments").get()).docs) {
			const result = transformAttachment(a.id, a.data() ?? {}, {
				companyId,
				parentType: "timeEntry",
				parentId: t.id,
				ownerUserId: data.userId ?? null,
			});
			if (result.doc) stage(C.attachments, result.doc.id, result.doc);
		}
	}
}

/* -------------------------------------------------------- compare to v2 */

const refFor = (collection, id) => {
	const segments = collection.split("/");
	let ref = firestore.collection(segments[0]);
	for (let i = 1; i < segments.length; i += 2) {
		ref = ref.doc(segments[i]).collection(segments[i + 1]);
	}
	return ref.doc(id);
};

const isNew = [];
const diverged = [];
const conflicts = [];
const deleted = [];

for (const [collection, docs] of expected) {
	// Subcollection paths are read per parent; top-level in one query.
	const existing = new Map();
	const snapshot = collection.includes("/")
		? await refFor(collection, "_").parent.get()
		: await firestore.collection(collection).get();
	for (const doc of snapshot.docs) existing.set(doc.id, doc.data());

	for (const [id, want] of docs) {
		const have = existing.get(id);
		if (!have) {
			isNew.push({ collection, id, data: want });
			continue;
		}
		if (!differs(have, want)) continue;

		/*
		 * v2 is newer than v1 -> a v2 client edited it after cutover.
		 * Overwriting would discard that work.
		 */
		if (millis(have.updatedAt) > millis(have.createdAt)) {
			conflicts.push({ collection, id });
		} else {
			diverged.push({ collection, id, data: want });
		}
	}

	for (const id of existing.keys()) {
		if (!docs.has(id)) deleted.push({ collection, id });
	}
}

/* ------------------------------------------------------------- report */

const summarize = (label, rows) => {
	console.log(`=== ${label}: ${rows.length} ===`);
	const byCollection = {};
	for (const r of rows) {
		byCollection[r.collection.replace(/\/[^/]+\//, "/*/")] =
			(byCollection[r.collection.replace(/\/[^/]+\//, "/*/")] ?? 0) + 1;
	}
	for (const [c, n] of Object.entries(byCollection).sort()) {
		console.log(`   ${c.padEnd(34)} ${n}`);
	}
	for (const r of rows.slice(0, 8)) console.log(`   ${r.collection}/${r.id}`);
	if (rows.length > 8) console.log(`   ...and ${rows.length - 8} more`);
	console.log("");
};

summarize("NEW (in v1, missing from v2)", isNew);
summarize("DIVERGED (v1 changed since migration)", diverged);
summarize("CONFLICTS (v2 edited since cutover — SKIPPED)", conflicts);
summarize("DELETED IN v1 (still in v2 — never auto-removed)", deleted);

const dir = new URL("../reports/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const path = `${dir}delta-${target}-${Date.now()}.json`;
writeFileSync(
	path,
	JSON.stringify(
		{
			target,
			generatedAt: new Date().toISOString(),
			isNew: isNew.map(({ collection, id }) => ({ collection, id })),
			diverged: diverged.map(({ collection, id }) => ({
				collection,
				id,
			})),
			conflicts,
			deleted,
		},
		null,
		2,
	),
);
console.log(`Report: ${path}`);

if (conflicts.length) {
	console.log(
		`\n${conflicts.length} conflict(s) were SKIPPED. A v2 client edited those\n` +
			"documents after the cutover; overwriting them would discard real work.\n" +
			"Resolve them by hand before relying on this sweep.",
	);
}
if (deleted.length) {
	console.log(
		`\n${deleted.length} document(s) exist in v2 but no longer in v1.\n` +
			"They are NOT removed — a deletion is not something to infer.",
	);
}

const writes = isNew.length + diverged.length;
if (!args.apply) {
	console.log(
		`\nDRY RUN — would write ${writes} document(s). Re-run with --apply.`,
	);
	process.exit(0);
}

if (writes === 0) {
	console.log("\nNothing to write; v2 already matches v1.");
	process.exit(0);
}

console.log(`\nWriting ${writes} document(s)...`);
const writer = firestore.bulkWriter();
writer.onWriteError((error) => error.failedAttempts < 5);
for (const { collection, id, data } of [...isNew, ...diverged]) {
	writer.set(refFor(collection, id), data);
}
await writer.close();

console.log(`Done. ${writes} document(s) written.`);
process.exit(0);
