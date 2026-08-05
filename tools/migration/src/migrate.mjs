/*
 * Reads v1, applies the pure transforms, writes v2 side by side.
 *
 *   node src/migrate.mjs --db=test            # dry run — transforms only
 *   node src/migrate.mjs --db=test --apply    # write
 *
 * Idempotent by construction: every v2 id is a deterministic function of the v1
 * data and every write is a full set() without merge, so re-running produces
 * byte-identical documents. That is why there is no resume cursor — at this
 * data size (~3k documents, minutes) re-running from scratch is simpler and
 * strictly safer than a partial resume.
 *
 * v1 is never modified. It remains the rollback target.
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

/** collection -> [{id, data}] */
const out = new Map();
const issues = [];
const stage = (collection, id, data) => {
	if (!out.has(collection)) out.set(collection, []);
	out.get(collection).push({ id, data });
};
const collect = (result) => {
	if (result?.issues?.length) issues.push(...result.issues);
	return result;
};

console.log(`Reading v1 from "${target}"...\n`);

// ---------------------------------------------------------------- users
const usersSnap = await firestore.collection("Users").get();
const userDocs = new Map(usersSnap.docs.map((d) => [d.id, d.data() ?? {}]));
const userIds = new Set(userDocs.keys());

const displayNameFor = (uid) => {
	const u = userDocs.get(uid);
	if (!u) return null;
	const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
	return name || u.email || null;
};

for (const [id, data] of userDocs) {
	stage(C.users, id, collect(transformUser(id, data)).doc);

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

// ------------------------------------------------------------ companies
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

	// ---- form schemas: dedupe preferences + every embedded entry snapshot
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
		collect(transformPreferences(companyId, prefs, { schemaIdFor })).doc,
	);

	// ---- memberships: union of both v1 sources
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
		const result = collect(
			transformMembership({
				companyId,
				userId: uid,
				membershipDoc: membershipDocs.get(uid) ?? null,
				userDoc: userDocs.get(uid) ?? null,
			}),
		);
		stage(C.memberships, membershipId(companyId, uid), result.doc);
	}

	// ---- library collections
	for (const c of checklists.docs) {
		stage(
			C.checklists,
			c.id,
			collect(transformChecklist(c.id, c.data() ?? {}, ctx)).doc,
		);
	}
	for (const p of packages.docs) {
		stage(
			C.packages,
			p.id,
			collect(
				transformPackage(p.id, p.data() ?? {}, {
					...ctx,
					checklistIds,
				}),
			).doc,
		);
	}
	for (const l of labels.docs) {
		stage(
			C.eventLabels,
			l.id,
			transformEventLabel(l.id, l.data() ?? {}, ctx).doc,
		);
	}

	// package -> checklist lookup, so events can carry a flat checklistIds
	const packageChecklists = new Map(
		packages.docs.map((p) => [
			p.id,
			(p.data()?.checklists ?? [])
				.map((e) => (typeof e === "string" ? e : e?.checklistId))
				.filter(Boolean),
		]),
	);

	// ---- events
	for (const e of events.docs) {
		const data = e.data() ?? {};
		const eventCtx = { ...ctx, labelIds, packageIds, userIds };
		const { doc } = collect(transformEvent(e.id, data, eventCtx));

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

		const state = collect(
			transformChecklistState(
				e.id,
				cls.docs.map((d) => ({ id: d.id, data: d.data() })),
				ctx,
			),
		);
		if (state.doc) stage(C.eventChecklistStates, e.id, state.doc);

		for (const a of atts.docs) {
			const result = collect(
				transformAttachment(a.id, a.data() ?? {}, {
					companyId,
					parentType: "event",
					parentId: e.id,
					ownerUserId: null,
				}),
			);
			if (result.doc) stage(C.attachments, result.doc.id, result.doc);
		}
	}

	// ---- time entries
	for (const t of timeEntries.docs) {
		const data = t.data() ?? {};
		const { doc } = collect(
			transformTimeEntry(t.id, data, { ...ctx, schemaIdFor }),
		);
		stage(C.timeEntries, t.id, doc);

		const conns = collect(
			transformConnections(t.id, data, { ...ctx, eventIds }),
		);
		for (const c of conns.docs) {
			stage(`${C.timeEntries}/${t.id}/${C.connections}`, c.id, c);
		}

		const edits = collect(
			transformEdits(t.id, data, { ...ctx, displayNameFor }),
		);
		for (const ed of edits.docs) {
			stage(`${C.timeEntries}/${t.id}/${C.edits}`, ed.id, ed);
		}

		const atts = await t.ref.collection("Attachments").get();
		for (const a of atts.docs) {
			const result = collect(
				transformAttachment(a.id, a.data() ?? {}, {
					companyId,
					parentType: "timeEntry",
					parentId: t.id,
					ownerUserId: data.userId ?? null,
				}),
			);
			if (result.doc) stage(C.attachments, result.doc.id, result.doc);
		}
	}
}

// ------------------------------------------------------------- summary
console.log("=== DOCUMENTS TO WRITE ===");
let total = 0;
const grouped = {};
for (const [collection, docs] of out) {
	// Collapse the per-parent subcollection paths into one line each.
	const key = collection.includes("/")
		? `${collection.split("/")[0]}/*/${collection.split("/").pop()}`
		: collection;
	grouped[key] = (grouped[key] ?? 0) + docs.length;
	total += docs.length;
}
for (const [key, count] of Object.entries(grouped).sort()) {
	console.log(`  ${key.padEnd(34)} ${count}`);
}
console.log(`  ${"TOTAL".padEnd(34)} ${total}\n`);

const orphanedResponses = (out.get(C.eventResponses) ?? []).filter(
	(d) => d.data.orphanedResponse,
).length;
if (orphanedResponses) {
	console.log(
		`  note: ${orphanedResponses} eventResponses belong to users no longer\n` +
			`        assigned to the event. Preserved and flagged, not dropped.\n`,
	);
}

const byCode = {};
for (const i of issues) byCode[i.code] = (byCode[i.code] ?? 0) + 1;
console.log("=== ISSUES ===");
if (!issues.length) console.log("  (none)");
for (const [code, count] of Object.entries(byCode).sort(
	(a, b) => b[1] - a[1],
)) {
	console.log(`  ${code.padEnd(46)} ${count}`);
}

const dir = new URL("../reports/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const issuePath = `${dir}migrate-issues-${target}-${Date.now()}.ndjson`;
writeFileSync(issuePath, issues.map((i) => JSON.stringify(i)).join("\n"));
console.log(`\nIssues written to ${issuePath}`);

if (!args.apply) {
	console.log("\nDRY RUN — nothing written. Re-run with --apply to commit.");
	process.exit(0);
}

// --------------------------------------------------------------- write
console.log(`\nWriting ${total} documents to "${target}"...`);

const writer = firestore.bulkWriter();
writer.onWriteError((error) => error.failedAttempts < 5);

for (const [collection, docs] of out) {
	for (const { id, data } of docs) {
		const segments = collection.split("/");
		let ref = firestore.collection(segments[0]);
		for (let i = 1; i < segments.length; i += 2) {
			ref = ref.doc(segments[i]).collection(segments[i + 1]);
		}
		writer.set(ref.doc(id), data);
	}
}

await writer.close();
console.log(`Done. ${total} documents written.`);
process.exit(0);
