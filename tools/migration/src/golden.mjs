/*
 * Renders hand-picked production documents side by side, v1 against v2, for
 * human review.
 *
 *   node src/golden.mjs --db=prod
 *
 * Read-only. This is the ONLY check that catches a transform which is
 * self-consistently wrong: count parity, invariants and referential integrity
 * all pass happily if a transform misreads v1's semantics in a uniform way.
 *
 * Specimens are SELECTED BY PREDICATE rather than pinned by id, so the set
 * automatically covers the interesting shapes instead of whatever was
 * interesting when it was written.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { db, parseArgs } from "./admin.mjs";
import { C } from "./paths.mjs";

const args = parseArgs();
const target = args.targets[0];
const firestore = db(target);

const show = (value) => {
	if (value === null || value === undefined) return "_null_";
	if (typeof value?.toDate === "function") {
		return `\`${value.toDate().toISOString()}\` _(Timestamp)_`;
	}
	if (typeof value === "object") {
		const json = JSON.stringify(value);
		return `\`${json.length > 220 ? `${json.slice(0, 220)}…` : json}\``;
	}
	return `\`${JSON.stringify(value)}\``;
};

const specimens = [];
const add = (title, why, v1, v2, fields) =>
	specimens.push({ title, why, v1, v2, fields });

// ------------------------------------------------------------- gather v1
const companies = await firestore.collection("Companies").get();
const v1Events = [];
const v1Entries = [];
const v1Attachments = [];

for (const company of companies.docs) {
	for (const e of (await company.ref.collection("Events").get()).docs) {
		v1Events.push({
			companyId: company.id,
			id: e.id,
			data: e.data() ?? {},
		});
		for (const a of (await e.ref.collection("Attachments").get()).docs) {
			v1Attachments.push({
				id: a.id,
				data: a.data() ?? {},
				parent: `event/${e.id}`,
			});
		}
	}
	for (const t of (await company.ref.collection("TimeEntries").get()).docs) {
		v1Entries.push({
			companyId: company.id,
			id: t.id,
			data: t.data() ?? {},
		});
		for (const a of (await t.ref.collection("Attachments").get()).docs) {
			v1Attachments.push({
				id: a.id,
				data: a.data() ?? {},
				parent: `timeEntry/${t.id}`,
			});
		}
	}
}

const getV2 = async (collection, id) => {
	const snap = await firestore.collection(collection).doc(id).get();
	return snap.exists ? snap.data() : null;
};

const pick = (list, predicate) => list.find((x) => predicate(x.data));

// --------------------------------------------------------------- events
const EVENT_FIELDS = [
	["title", "title"],
	["date", "dateKey"],
	["startTime", "startAt"],
	["endTime", "endAt"],
	["duration", "durationSeconds"],
	["notes", "adminNotes"],
	["userNotes", "workerNotes"],
	["assignedWorkers", "assignedUserIds"],
	[null, "assignedCount"],
	[null, "isAllDay"],
	["labelId", "labelId"],
	["packages", "packageIds"],
	["workerStatus", null],
	[null, "responseCounts"],
];

const bareTimeEvent = pick(v1Events, (d) =>
	/^\d{1,2}:\d{2}$/.test(d.startTime ?? ""),
);
if (bareTimeEvent) {
	add(
		`Event with a bare time-of-day — \`${bareTimeEvent.id}\``,
		'The format nobody knew existed. `startTime: "17:30"` has no date and no zone; ' +
			"v2 resolves it against the event's own dateKey in America/New_York. " +
			"CHECK: does startAt land at the time this event actually ran?",
		bareTimeEvent.data,
		await getV2(C.events, bareTimeEvent.id),
		EVENT_FIELDS,
	);
}

const allDay = pick(v1Events, (d) => !d.startTime && d.duration);
if (allDay) {
	add(
		`All-day event — \`${allDay.id}\``,
		"v1 encoded all-day as `startTime === null`. v2 makes it an explicit flag " +
			"and keeps the stored duration since there is nothing to compute from.",
		allDay.data,
		await getV2(C.events, allDay.id),
		EVENT_FIELDS,
	);
}

const busiest = [...v1Events].sort(
	(a, b) =>
		Object.keys(b.data.workerStatus ?? {}).length -
		Object.keys(a.data.workerStatus ?? {}).length,
)[0];
if (busiest) {
	const responses = await firestore
		.collection(C.eventResponses)
		.where("eventId", "==", busiest.id)
		.get();
	const orphaned = responses.docs.filter((d) => d.data().orphanedResponse);
	add(
		`Event with the most responses — \`${busiest.id}\``,
		`v1 workerStatus had ${Object.keys(busiest.data.workerStatus ?? {}).length} entries ` +
			`for ${(busiest.data.assignedWorkers ?? []).length} assigned workers. ` +
			`v2 produced ${responses.size} eventResponses, ${orphaned.length} flagged orphaned. ` +
			"CHECK: are the orphaned ones really people who were unassigned after responding?",
		busiest.data,
		await getV2(C.events, busiest.id),
		EVENT_FIELDS,
	);
}

// ---------------------------------------------------------- time entries
const ENTRY_FIELDS = [
	["status", "status"],
	["clockInTime", "clockInAt"],
	["clockOutTime", "clockOutAt"],
	["duration", "workedSeconds"],
	["totalPausedSeconds", "pausedSeconds"],
	["approvedBy", null],
	["rejectedBy", null],
	["rejectedAt", null],
	[null, "review"],
	[null, "legacy"],
	[null, "formSchemaIds"],
	[null, "connectionCount"],
	[null, "editCount"],
];

const bugApproval = pick(
	v1Entries,
	(d) => d.status === "approved" && d.rejectedBy && !d.approvedBy,
);
if (bugApproval) {
	add(
		`Approved entry stamped \`rejectedBy\` — \`${bugApproval.id}\``,
		"The 2,104-record bug path. v1's approve button wrote rejectedAt/rejectedBy. " +
			"v2 infers the approver from those fields and marks provenance " +
			"`inferred_from_status_bug`, keeping the raw v1 fields under `legacy`. " +
			"CHECK: is decidedBy actually the person who approves timesheets?",
		bugApproval.data,
		await getV2(C.timeEntries, bugApproval.id),
		ENTRY_FIELDS,
	);
}

const trustedApproval = pick(
	v1Entries,
	(d) => d.status === "approved" && d.approvedBy,
);
if (trustedApproval) {
	add(
		`Approved entry with a real \`approvedBy\` — \`${trustedApproval.id}\``,
		"One of only 12. Provenance should be `trusted`.",
		trustedApproval.data,
		await getV2(C.timeEntries, trustedApproval.id),
		ENTRY_FIELDS,
	);
}

const richest = [...v1Entries].sort(
	(a, b) =>
		Object.keys(b.data.formResponses ?? {}).length -
		Object.keys(a.data.formResponses ?? {}).length,
)[0];
if (richest) {
	add(
		`Entry with the most form responses — \`${richest.id}\``,
		"Confirms the embedded schema snapshot became a reference without losing " +
			"the answers. CHECK: formResponses should be byte-identical to v1.",
		richest.data,
		await getV2(C.timeEntries, richest.id),
		[...ENTRY_FIELDS, ["formResponses", "formResponses"]],
	);
}

// -------------------------------------------------- subcollection samples
const withEdits = [...v1Entries]
	.filter((x) => (x.data.editHistory ?? []).length > 1)
	.sort((a, b) => b.data.editHistory.length - a.data.editHistory.length)[0];

if (withEdits) {
	const edits = await firestore
		.collection(C.timeEntries)
		.doc(withEdits.id)
		.collection(C.edits)
		.get();
	add(
		`Longest edit history — \`${withEdits.id}\``,
		`${withEdits.data.editHistory.length} v1 entries -> ${edits.size} edits documents. ` +
			"v1 had three writer shapes and the renderer read a fourth key set that no " +
			"writer produced, which is why edit history never showed an author. " +
			"CHECK: does actorDisplayName name the right person, and does summary read correctly?",
		{ editHistory: withEdits.data.editHistory },
		{
			edits: edits.docs.map((d) => ({
				id: d.id,
				at: d.data().at?.toDate?.()?.toISOString(),
				actor: d.data().actorDisplayName,
				summary: d.data().summary,
				source: d.data().source,
			})),
		},
		[["editHistory", "edits"]],
	);
}

const withCustom = pick(v1Entries, (d) =>
	(d.connectedEvents ?? []).some((c) => /^custom[-_]/.test(c?.eventId ?? "")),
);
if (withCustom) {
	const conns = await firestore
		.collection(C.timeEntries)
		.doc(withCustom.id)
		.collection(C.connections)
		.get();
	add(
		`Entry with an ad-hoc connection — \`${withCustom.id}\``,
		"v1 wrote `custom-` but filtered on `custom_`, so 1,984 of these were never " +
			"excluded from package lookups. v2 sets eventId to null and keeps the title. " +
			"CHECK: customTitle should carry the job name the worker typed.",
		{ connectedEvents: withCustom.data.connectedEvents },
		{
			connections: conns.docs.map((d) => ({
				id: d.id,
				eventId: d.data().eventId,
				customTitle: d.data().customTitle,
				snapshot: d.data().eventTitleSnapshot,
			})),
		},
		[["connectedEvents", "connections"]],
	);
}

// ---------------------------------------------------------- attachments
const ATTACHMENT_FIELDS = [
	["name", "fileName"],
	["type", "contentType"],
	["size", "sizeBytes"],
	["storageRef", "storagePath"],
	["path", "storagePath"],
	["downloadUrl", "downloadUrl"],
	["url", "downloadUrl"],
	["createdAt", "createdAt"],
	["uploadTime", "createdAt"],
];

const legacyAttachment = v1Attachments.find(
	(a) => a.data.path && !a.data.storageRef,
);
if (legacyAttachment) {
	add(
		`Legacy-generation attachment — \`${legacyAttachment.id}\``,
		"13 of 32 attachments use path/url/uploadTime instead of " +
			"storageRef/downloadUrl/createdAt. Reading storageRef as missing would have " +
			"orphaned these Storage objects. CHECK: storagePath must match the real object.",
		legacyAttachment.data,
		await getV2(C.attachments, legacyAttachment.id),
		ATTACHMENT_FIELDS,
	);
}

const modernAttachment = v1Attachments.find((a) => a.data.storageRef);
if (modernAttachment) {
	add(
		`Modern-generation attachment — \`${modernAttachment.id}\``,
		"The current shape, for contrast with the legacy one above.",
		modernAttachment.data,
		await getV2(C.attachments, modernAttachment.id),
		ATTACHMENT_FIELDS,
	);
}

// -------------------------------------------------------------- render
const lines = [
	`# Golden set — \`${target}\``,
	"",
	`Generated ${new Date().toISOString()}`,
	"",
	"Each specimen shows the v1 document beside what the migration produced.",
	"Read the **CHECK** note on each and confirm it by eye. Count parity and",
	"invariants cannot catch a transform that is wrong in a consistent way —",
	"only this can.",
	"",
	`${specimens.length} specimens.`,
	"",
];

for (const s of specimens) {
	lines.push(
		`## ${s.title}`,
		"",
		s.why,
		"",
		"| v1 field | v1 value | v2 field | v2 value |",
		"|---|---|---|---|",
	);
	for (const [from, to] of s.fields) {
		const v1Value = from ? show(s.v1?.[from]) : "—";
		const v2Value = to ? show(s.v2?.[to]) : "—";
		if (from && s.v1?.[from] === undefined && to === null) continue;
		lines.push(
			`| ${from ?? "—"} | ${v1Value} | ${to ?? "—"} | ${v2Value} |`,
		);
	}
	lines.push("");
}

const dir = new URL("../reports/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const path = `${dir}golden-${target}-${Date.now()}.md`;
writeFileSync(path, lines.join("\n"));

console.log(`${specimens.length} specimens written to:\n  ${path}\n`);
for (const s of specimens) console.log(`  - ${s.title}`);
process.exit(0);
