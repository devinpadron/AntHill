/*
 * Checks v2 against v1 after a migration. Exits non-zero on any failure.
 *
 *   node src/verify.mjs --db=test
 *
 * Read-only. Three independent layers:
 *   1. count parity      — did everything arrive
 *   2. invariants        — is what arrived internally consistent
 *   3. referential       — does every reference resolve
 *
 * A green run does NOT prove the transforms interpreted v1 correctly — only
 * that they were applied consistently. The golden-set spot check is what
 * catches a transform that is self-consistently wrong.
 */
import { db, parseArgs } from "./admin.mjs";
import { C } from "./paths.mjs";

const args = parseArgs();
const target = args.targets[0];
const firestore = db(target);

const failures = [];
const notes = [];
const fail = (check, detail) => failures.push({ check, detail });
const pass = (check, detail) => notes.push({ check, detail });

const idsOf = (snap) => new Set(snap.docs.map((d) => d.id));

console.log(`Verifying "${target}"...\n`);

// ---------------------------------------------------------- load v1 + v2
const [v1Users, v1Companies] = await Promise.all([
	firestore.collection("Users").get(),
	firestore.collection("Companies").get(),
]);

const v1Counts = {
	users: v1Users.size,
	companies: v1Companies.size,
	events: 0,
	timeEntries: 0,
	packages: 0,
	checklists: 0,
	eventLabels: 0,
	memberships: 0,
	attachments: 0,
};

const v1EventIds = new Set();
const v1TimeEntryIds = new Set();

for (const company of v1Companies.docs) {
	const [members, events, entries, packages, checklists, labels] =
		await Promise.all([
			company.ref.collection("Users").get(),
			company.ref.collection("Events").get(),
			company.ref.collection("TimeEntries").get(),
			company.ref.collection("Packages").get(),
			company.ref.collection("Checklists").get(),
			company.ref.collection("EventLabels").get(),
		]);

	v1Counts.memberships += members.size;
	v1Counts.events += events.size;
	v1Counts.timeEntries += entries.size;
	v1Counts.packages += packages.size;
	v1Counts.checklists += checklists.size;
	v1Counts.eventLabels += labels.size;

	for (const e of events.docs) {
		v1EventIds.add(e.id);
		v1Counts.attachments += (
			await e.ref.collection("Attachments").get()
		).size;
	}
	for (const t of entries.docs) {
		v1TimeEntryIds.add(t.id);
		v1Counts.attachments += (
			await t.ref.collection("Attachments").get()
		).size;
	}
}

const v2 = {};
for (const name of [
	C.users,
	C.companies,
	C.memberships,
	C.events,
	C.eventResponses,
	C.eventChecklistStates,
	C.timeEntries,
	C.packages,
	C.checklists,
	C.eventLabels,
	C.attachments,
	C.formSchemas,
	C.companyPreferences,
]) {
	v2[name] = await firestore.collection(name).get();
}

if (v2[C.events].empty && v2[C.timeEntries].empty) {
	console.error("v2 collections are empty — has the migration run?");
	process.exit(1);
}

// ------------------------------------------------------- 1. count parity
const parity = [
	["users", v1Counts.users, v2[C.users].size],
	["companies", v1Counts.companies, v2[C.companies].size],
	["events", v1Counts.events, v2[C.events].size],
	["timeEntries", v1Counts.timeEntries, v2[C.timeEntries].size],
	["packages", v1Counts.packages, v2[C.packages].size],
	["checklists", v1Counts.checklists, v2[C.checklists].size],
	["eventLabels", v1Counts.eventLabels, v2[C.eventLabels].size],
	["attachments", v1Counts.attachments, v2[C.attachments].size],
];

console.log("=== COUNT PARITY ===");
for (const [name, before, after] of parity) {
	const ok = before === after;
	console.log(
		`  ${ok ? "ok  " : "FAIL"} ${name.padEnd(22)} v1 ${String(before).padStart(5)}  ->  v2 ${String(after).padStart(5)}`,
	);
	if (!ok) fail("COUNT_PARITY", { name, before, after });
}

// memberships is a UNION of two v1 sources, so >= is correct, not ==
const v2Memberships = v2[C.memberships].size;
console.log(
	`  ${v2Memberships >= v1Counts.memberships ? "ok  " : "FAIL"} ${"memberships".padEnd(22)} v1 ${String(v1Counts.memberships).padStart(5)}  ->  v2 ${String(v2Memberships).padStart(5)}  (union of both v1 sources)`,
);
if (v2Memberships < v1Counts.memberships) {
	fail("MEMBERSHIP_LOSS", {
		before: v1Counts.memberships,
		after: v2Memberships,
	});
}

// ---------------------------------------------------------- 2. invariants
console.log("\n=== INVARIANTS ===");

const companyIds = idsOf(v2[C.companies]);
const userIds = idsOf(v2[C.users]);
const eventIds = idsOf(v2[C.events]);
const labelIds = idsOf(v2[C.eventLabels]);
const packageIds = idsOf(v2[C.packages]);
const checklistIds = idsOf(v2[C.checklists]);
const schemaIds = idsOf(v2[C.formSchemas]);

// Fatal: a document with no companyId is unreachable under the security rules.
let missingCompanyId = 0;
for (const name of [
	C.memberships,
	C.events,
	C.eventResponses,
	C.timeEntries,
	C.packages,
	C.checklists,
	C.eventLabels,
	C.attachments,
	C.formSchemas,
]) {
	for (const doc of v2[name].docs) {
		const cid = doc.data()?.companyId;
		if (!cid) {
			missingCompanyId += 1;
			fail("COMPANY_ID_MISSING", `${name}/${doc.id}`);
		} else if (!companyIds.has(cid)) {
			fail("COMPANY_ID_DANGLING", `${name}/${doc.id} -> ${cid}`);
		}
	}
}
check(
	"every company-scoped document has a resolvable companyId",
	missingCompanyId === 0,
);

// No stringly-typed instants survived.
let stringTimestamps = 0;
const instantFields = {
	[C.events]: ["startAt", "endAt"],
	[C.timeEntries]: ["clockInAt", "clockOutAt", "pauseStartedAt"],
	[C.attachments]: ["createdAt"],
};
for (const [name, fields] of Object.entries(instantFields)) {
	for (const doc of v2[name].docs) {
		for (const f of fields) {
			const v = doc.data()?.[f];
			if (typeof v === "string") {
				stringTimestamps += 1;
				fail("TIMESTAMP_IS_STRING", `${name}/${doc.id}.${f}`);
			}
		}
	}
}
check("no instant field holds a string", stringTimestamps === 0);

// Denormalized counters must match reality.
let badAssignedCount = 0;
for (const doc of v2[C.events].docs) {
	const d = doc.data();
	if ((d.assignedUserIds ?? []).length !== d.assignedCount) {
		badAssignedCount += 1;
		fail("ASSIGNED_COUNT_MISMATCH", doc.id);
	}
}
check(
	"events.assignedCount matches assignedUserIds.length",
	badAssignedCount === 0,
);

let badWorked = 0;
for (const doc of v2[C.timeEntries].docs) {
	const d = doc.data();
	if (!d.clockInAt || !d.clockOutAt || d.workedSeconds == null) continue;
	const elapsed = (d.clockOutAt.toMillis() - d.clockInAt.toMillis()) / 1000;
	if (d.workedSeconds > elapsed + 60) {
		badWorked += 1;
		fail("WORKED_EXCEEDS_ELAPSED", doc.id);
	}
}
check(
	"workedSeconds never exceeds elapsed time",
	badWorked === 0,
	`${badWorked} over`,
);

// Subcollection counters, sampled — reading every subcollection is O(entries).
let counterMismatches = 0;
const sample = v2[C.timeEntries].docs.slice(0, 100);
for (const doc of sample) {
	const d = doc.data();
	const [conns, edits] = await Promise.all([
		doc.ref.collection(C.connections).get(),
		doc.ref.collection(C.edits).get(),
	]);
	if (conns.size !== d.connectionCount || edits.size !== d.editCount) {
		counterMismatches += 1;
		fail("SUBCOLLECTION_COUNT_MISMATCH", {
			id: doc.id,
			connectionCount: [d.connectionCount, conns.size],
			editCount: [d.editCount, edits.size],
		});
	}
}
check(
	`connection/edit counters match subcollections (${sample.length} sampled)`,
	counterMismatches === 0,
);

// responseCounts must match the eventResponses actually written. A counter that
// is merely self-consistent passes every other check while being wrong — this
// is the invariant version of what the golden set caught by eye.
const responsesByEvent = {};
for (const doc of v2[C.eventResponses].docs) {
	const d = doc.data();
	responsesByEvent[d.eventId] = responsesByEvent[d.eventId] ?? {
		confirmed: 0,
		declined: 0,
		pending: 0,
	};
	responsesByEvent[d.eventId][d.status] += 1;
}
let badResponseCounts = 0;
for (const doc of v2[C.events].docs) {
	const stated = doc.data()?.responseCounts ?? {};
	const actual = responsesByEvent[doc.id] ?? {
		confirmed: 0,
		declined: 0,
		pending: 0,
	};
	for (const k of ["confirmed", "declined", "pending"]) {
		if ((stated[k] ?? 0) !== actual[k]) {
			badResponseCounts += 1;
			fail("RESPONSE_COUNT_MISMATCH", { event: doc.id, stated, actual });
			break;
		}
	}
}
check(
	"events.responseCounts matches the eventResponses written",
	badResponseCounts === 0,
	badResponseCounts ? `${badResponseCounts} events` : "",
);

// Approval provenance must be explicit wherever a decision exists.
let provenanceMissing = 0;
const provenance = {};
for (const doc of v2[C.timeEntries].docs) {
	const review = doc.data()?.review;
	if (!review) continue;
	if (!review.provenance) {
		provenanceMissing += 1;
		fail("REVIEW_NO_PROVENANCE", doc.id);
	}
	provenance[review.provenance] = (provenance[review.provenance] ?? 0) + 1;
}
check("every review records its provenance", provenanceMissing === 0);

// -------------------------------------------------------- 3. referential
console.log("\n=== REFERENTIAL INTEGRITY ===");

const refCheck = (label, docs, resolve) => {
	let broken = 0;
	for (const doc of docs) {
		for (const bad of resolve(doc.data(), doc.id) ?? []) {
			broken += 1;
			fail("REFERENCE_DANGLING", `${label}: ${bad}`);
		}
	}
	check(label, broken === 0, broken ? `${broken} dangling` : "");
};

refCheck("events.labelId resolves", v2[C.events].docs, (d, id) =>
	d.labelId && !labelIds.has(d.labelId) ? [`${id} -> ${d.labelId}`] : [],
);
refCheck("events.packageIds resolve", v2[C.events].docs, (d, id) =>
	(d.packageIds ?? [])
		.filter((p) => !packageIds.has(p))
		.map((p) => `${id} -> ${p}`),
);
refCheck("events.checklistIds resolve", v2[C.events].docs, (d, id) =>
	(d.checklistIds ?? [])
		.filter((c) => !checklistIds.has(c))
		.map((c) => `${id} -> ${c}`),
);
refCheck(
	"eventResponses.eventId resolves",
	v2[C.eventResponses].docs,
	(d, id) => (eventIds.has(d.eventId) ? [] : [`${id} -> ${d.eventId}`]),
);
refCheck("memberships.userId resolves", v2[C.memberships].docs, (d, id) =>
	userIds.has(d.userId) ? [] : [`${id} -> ${d.userId}`],
);
refCheck("timeEntries.formSchemaIds resolve", v2[C.timeEntries].docs, (d, id) =>
	Object.values(d.formSchemaIds ?? {})
		.filter((s) => s && !schemaIds.has(s))
		.map((s) => `${id} -> ${s}`),
);
refCheck("attachments.parentId resolves", v2[C.attachments].docs, (d, id) => {
	const pool = d.parentType === "event" ? eventIds : v2TimeEntryIds();
	return pool.has(d.parentId)
		? []
		: [`${id} -> ${d.parentType}/${d.parentId}`];
});

function v2TimeEntryIds() {
	return idsOf(v2[C.timeEntries]);
}

// ------------------------------------------------------------- summary
function check(label, ok, detail = "") {
	console.log(
		`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`,
	);
	if (ok) pass(label);
}

console.log("\n=== APPROVAL PROVENANCE ===");
for (const [k, v] of Object.entries(provenance).sort((a, b) => b[1] - a[1])) {
	console.log(`  ${k.padEnd(30)} ${v}`);
}

console.log(
	`\n${failures.length === 0 ? "PASS" : `FAIL — ${failures.length} problem(s)`}`,
);
for (const f of failures.slice(0, 25)) {
	console.log(`  ${f.check}: ${JSON.stringify(f.detail)}`);
}
if (failures.length > 25) console.log(`  ...and ${failures.length - 25} more`);

process.exit(failures.length ? 1 : 0);
