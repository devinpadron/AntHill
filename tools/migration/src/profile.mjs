/*
 * Read-only census of the v1 database. THE GATE for the migration.
 *
 *   node src/profile.mjs --db=prod
 *
 * Writes reports/profile-<timestamp>.json and prints a summary. Nothing in the
 * migration should be designed against assumptions this pass can settle with
 * real numbers.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { db, parseArgs } from "./admin.mjs";
import { classifyTimestamp } from "./primitives/timestamps.mjs";

const args = parseArgs();
const target = args.targets[0];
const firestore = db(target);

const tally = () => ({});
const bump = (map, key, n = 1) => {
	map[key] = (map[key] ?? 0) + n;
};
const sizeOf = (data) => JSON.stringify(data ?? {}).length;

const report = {
	database: target,
	generatedAt: new Date().toISOString(),
	volume: {},
	perCompany: {},
	shapes: {},
	timestamps: {},
	referential: {},
	samples: {},
};

const sample = (key, value) => {
	report.samples[key] = report.samples[key] ?? [];
	if (report.samples[key].length < 5) report.samples[key].push(value);
};

const tsBranches = tally();
const noteTimestamp = (field, value) => {
	const { branch } = classifyTimestamp(value);
	bump(tsBranches, `${field}:${branch}`);
	if (branch === "unparseable") sample(`unparseable:${field}`, value);
};

// ---------------------------------------------------------------- users
const usersSnap = await firestore.collection("Users").get();
const userIds = new Set(usersSnap.docs.map((d) => d.id));
const userShapes = tally();

for (const u of usersSnap.docs) {
	const d = u.data() ?? {};
	bump(
		userShapes,
		Array.isArray(d.companies)
			? "companies:array"
			: d.companies && typeof d.companies === "object"
				? "companies:MAP(legacy)"
				: "companies:missing",
	);
	bump(userShapes, d.id ? "id:present" : "id:MISSING");
	bump(
		userShapes,
		Array.isArray(d.fcmToken)
			? "fcmToken:array"
			: d.fcmToken
				? "fcmToken:NOT_ARRAY"
				: "fcmToken:absent",
	);
	bump(
		userShapes,
		d.lastSeenAppVersion
			? `lastSeen:${d.lastSeenAppVersion}`
			: "lastSeen:never",
	);
}
report.volume.users = usersSnap.size;
report.shapes.users = userShapes;

// ------------------------------------------------------------ companies
const companiesSnap = await firestore.collection("Companies").get();
report.volume.companies = companiesSnap.size;

const formFieldShapes = tally();
const checklistShapes = tally();
const eventShapes = tally();
const eventChecklistShapes = tally();
const timeEntryShapes = tally();
const statusHistogram = tally();
const editHistoryShapes = tally();
const connectionShapes = tally();
const attachmentKeySets = tally();
const formResponseShapes = tally();
const dangling = {
	labelId: [],
	packageId: [],
	checklistId: [],
	assignedWorker: [],
	connectedEvent: [],
};

let maxEditHistory = 0;
let maxFormResponses = 0;
let maxDocSize = 0;
const totals = {
	events: 0,
	timeEntries: 0,
	packages: 0,
	checklists: 0,
	labels: 0,
	attachments: 0,
	eventChecklistStates: 0,
	memberships: 0,
	responsesFanout: 0,
};

for (const company of companiesSnap.docs) {
	const cid = company.id;
	const per = { name: company.data()?.name ?? "?" };

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

	per.members = members.size;
	per.events = events.size;
	per.timeEntries = timeEntries.size;
	per.packages = packages.size;
	per.checklists = checklists.size;
	per.labels = labels.size;

	totals.memberships += members.size;
	totals.events += events.size;
	totals.timeEntries += timeEntries.size;
	totals.packages += packages.size;
	totals.checklists += checklists.size;
	totals.labels += labels.size;

	const labelIds = new Set(labels.docs.map((d) => d.id));
	const packageIds = new Set(packages.docs.map((d) => d.id));
	const checklistIds = new Set(checklists.docs.map((d) => d.id));
	const eventIds = new Set(events.docs.map((d) => d.id));

	// ---- company form schemas
	if (settings.exists) {
		const prefs = settings.data() ?? {};
		for (const kind of ["eventForm", "timeEntryForm"]) {
			const form = prefs[kind];
			if (!form) {
				bump(formFieldShapes, `${kind}:absent`);
				continue;
			}
			bump(formFieldShapes, `${kind}:present`);
			for (const f of form.fields ?? []) {
				bump(formFieldShapes, `fieldType:${f.type ?? "undefined"}`);
				if (f.type === "checklist") {
					if (f.checklistId)
						bump(formFieldShapes, "checklist:checklistId");
					else if (Array.isArray(f.options))
						bump(
							formFieldShapes,
							"checklist:INLINE_OPTIONS(legacy)",
						);
					else bump(formFieldShapes, "checklist:NEITHER(broken)");
				}
			}
		}
	} else {
		bump(formFieldShapes, "settings/preferences:MISSING");
	}

	// ---- checklists
	for (const c of checklists.docs) {
		const d = c.data() ?? {};
		const items = d.items;
		if (!Array.isArray(items)) bump(checklistShapes, "items:NOT_ARRAY");
		else if (items.length === 0) bump(checklistShapes, "items:empty");
		else {
			const strings = items.filter((i) => typeof i === "string").length;
			const objects = items.filter(
				(i) => i && typeof i === "object",
			).length;
			if (strings && objects)
				bump(checklistShapes, "items:MIXED(legacy+new)");
			else if (strings) bump(checklistShapes, "items:string[](legacy)");
			else {
				bump(checklistShapes, "items:{id,text}[]");
				if (items.some((i) => !i.id))
					bump(checklistShapes, "items:OBJECT_MISSING_ID");
			}
		}
		bump(
			checklistShapes,
			d.title ? "title" : d.name ? "name(legacy)" : "NEITHER",
		);
	}

	// ---- events
	for (const e of events.docs) {
		const d = e.data() ?? {};
		maxDocSize = Math.max(maxDocSize, sizeOf(d));

		const ws = d.workerStatus;
		bump(
			eventShapes,
			Array.isArray(ws)
				? "workerStatus:ARRAY(typed-but-unexpected)"
				: ws && typeof ws === "object"
					? "workerStatus:map"
					: "workerStatus:absent",
		);
		if (ws && typeof ws === "object" && !Array.isArray(ws)) {
			for (const v of Object.values(ws))
				bump(eventShapes, `workerStatusValue:${v}`);
		}

		bump(
			eventShapes,
			d.labelId ? "labelId" : d.label ? "label(legacy)" : "label:none",
		);
		if (d.labelId && !labelIds.has(d.labelId))
			dangling.labelId.push(`${cid}/${e.id} -> ${d.labelId}`);

		const aw = d.assignedWorkers;
		bump(
			eventShapes,
			Array.isArray(aw)
				? aw.length === 0
					? "assignedWorkers:[]"
					: "assignedWorkers:populated"
				: "assignedWorkers:ABSENT",
		);
		if (Array.isArray(aw)) {
			totals.responsesFanout += aw.length;
			for (const uid of aw)
				if (!userIds.has(uid))
					dangling.assignedWorker.push(`${cid}/${e.id} -> ${uid}`);
		}

		for (const p of d.packages ?? []) {
			bump(
				eventShapes,
				typeof p === "string"
					? "packages:string"
					: "packages:OBJECT(vestigial)",
			);
			const pid = typeof p === "string" ? p : p?.id;
			if (pid && !packageIds.has(pid))
				dangling.packageId.push(`${cid}/${e.id} -> ${pid}`);
		}

		if (d.notes) bump(eventShapes, "notes:set");
		if (d.userNotes) bump(eventShapes, "userNotes:set");
		if (d.notes && d.userNotes) bump(eventShapes, "notes+userNotes:BOTH");

		bump(
			eventShapes,
			d.startTime === null || d.startTime === undefined
				? "startTime:null(all-day)"
				: "startTime:set",
		);
		noteTimestamp("event.startTime", d.startTime);
		noteTimestamp("event.endTime", d.endTime);
		noteTimestamp("event.date", d.date);

		if (d.duration !== undefined && d.duration !== null) {
			bump(
				eventShapes,
				Number.isFinite(parseFloat(d.duration))
					? "duration:parseable"
					: "duration:UNPARSEABLE",
			);
		}

		const [atts, cls] = await Promise.all([
			e.ref.collection("Attachments").get(),
			e.ref.collection("Checklists").get(),
		]);
		totals.attachments += atts.size;
		for (const a of atts.docs) {
			const ad = a.data() ?? {};
			bump(attachmentKeySets, Object.keys(ad).sort().join(","));
			if (!ad.storageRef) bump(attachmentKeySets, "MISSING_storageRef");
		}
		if (cls.size) totals.eventChecklistStates += 1;
		for (const cl of cls.docs) {
			const state = cl.data() ?? {};
			for (const [itemId, v] of Object.entries(state)) {
				if (itemId === "undefined")
					bump(eventChecklistShapes, "key:UNDEFINED(unrecoverable)");
				bump(eventChecklistShapes, `value:${typeof v}`);
			}
			if (!checklistIds.has(cl.id))
				dangling.checklistId.push(`${cid}/${e.id}/Checklists/${cl.id}`);
		}
	}

	// ---- time entries
	for (const t of timeEntries.docs) {
		const d = t.data() ?? {};
		maxDocSize = Math.max(maxDocSize, sizeOf(d));
		bump(statusHistogram, d.status ?? "MISSING");

		if (d.status === "approved") {
			if (d.approvedBy)
				bump(timeEntryShapes, "approved:approvedBy(trusted)");
			else if (d.rejectedBy)
				bump(timeEntryShapes, "approved:rejectedBy(BUG)");
			else bump(timeEntryShapes, "approved:NEITHER(unknown)");
		}
		if (d.rejectionReason) bump(timeEntryShapes, "rejectionReason:set");
		if (d.submissionNotes) bump(timeEntryShapes, "submissionNotes:set");
		if (d.eventForm) bump(timeEntryShapes, "embedded:eventForm");
		if (d.generalForm) bump(timeEntryShapes, "embedded:generalForm");

		noteTimestamp("timeEntry.clockInTime", d.clockInTime);
		noteTimestamp("timeEntry.clockOutTime", d.clockOutTime);

		const eh = d.editHistory ?? [];
		maxEditHistory = Math.max(maxEditHistory, eh.length);
		for (const edit of eh) {
			if (edit?.editor) bump(editHistoryShapes, "A:editor{}(EditSheet)");
			else if (edit?.userId && edit?.changeSummary)
				bump(editHistoryShapes, "B:userId+changeSummary");
			else bump(editHistoryShapes, "OTHER:unknown");
			if (edit?.userName)
				bump(editHistoryShapes, "has userName(renderer key)");
		}

		const conns = d.connectedEvents ?? [];
		for (const c of conns) {
			const eid = c?.eventId ?? "";
			if (/^custom-/.test(eid))
				bump(connectionShapes, "custom-(hyphen, as written)");
			else if (/^custom_/.test(eid))
				bump(connectionShapes, "custom_(underscore, as filtered)");
			else if (eventIds.has(eid)) bump(connectionShapes, "real event");
			else {
				bump(connectionShapes, "DANGLING");
				dangling.connectedEvent.push(`${cid}/${t.id} -> ${eid}`);
			}
			if (c?.startOverlap !== undefined)
				bump(connectionShapes, "has startOverlap");
		}

		const fr = d.formResponses ?? {};
		maxFormResponses = Math.max(maxFormResponses, Object.keys(fr).length);
		for (const v of Object.values(fr)) {
			if (Array.isArray(v) && v.some((x) => x && typeof x === "object")) {
				bump(formResponseShapes, "EMBEDDED_FILE_OBJECTS");
				for (const file of v) {
					if (file && typeof file === "object") {
						bump(
							formResponseShapes,
							`fileKeys:${Object.keys(file).sort().join(",")}`,
						);
					}
				}
			} else bump(formResponseShapes, `scalar:${typeof v}`);
		}

		const atts = await t.ref.collection("Attachments").get();
		totals.attachments += atts.size;
		for (const a of atts.docs) {
			const ad = a.data() ?? {};
			bump(attachmentKeySets, Object.keys(ad).sort().join(","));
			if (!ad.storageRef) bump(attachmentKeySets, "MISSING_storageRef");
		}
	}

	report.perCompany[cid] = per;
}

report.volume = { ...report.volume, ...totals };
report.volume.maxEditHistoryLength = maxEditHistory;
report.volume.maxFormResponseKeys = maxFormResponses;
report.volume.maxDocSizeBytes = maxDocSize;
report.shapes = {
	users: userShapes,
	formFields: formFieldShapes,
	checklists: checklistShapes,
	events: eventShapes,
	eventChecklistStates: eventChecklistShapes,
	timeEntries: timeEntryShapes,
	timeEntryStatus: statusHistogram,
	editHistory: editHistoryShapes,
	connections: connectionShapes,
	formResponses: formResponseShapes,
	attachments: attachmentKeySets,
};
report.timestamps = tsBranches;
report.referential = Object.fromEntries(
	Object.entries(dangling).map(([k, v]) => [
		k,
		{ count: v.length, examples: v.slice(0, 10) },
	]),
);

const dir = new URL("../reports/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const path = `${dir}profile-${target}-${Date.now()}.json`;
writeFileSync(path, JSON.stringify(report, null, 2));

const section = (title, obj) => {
	console.log(`\n=== ${title} ===`);
	const entries = Object.entries(obj);
	if (!entries.length) return console.log("  (none)");
	for (const [k, v] of entries.sort(
		(a, b) =>
			(typeof b[1] === "number" ? b[1] : 0) -
			(typeof a[1] === "number" ? a[1] : 0),
	)) {
		console.log(
			`  ${String(k).padEnd(52)} ${typeof v === "object" ? JSON.stringify(v) : v}`,
		);
	}
};

console.log(`PROFILE — database "${target}"`);
section("VOLUME", report.volume);
section("PER COMPANY", report.perCompany);
for (const [k, v] of Object.entries(report.shapes)) section(`SHAPES: ${k}`, v);
section("TIMESTAMP BRANCHES", report.timestamps);
section("REFERENTIAL INTEGRITY", report.referential);
console.log(`\nFull report: ${path}`);
process.exit(0);
