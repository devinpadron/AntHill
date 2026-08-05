/*
 * Runs every query shape the v2 services issue, against real data.
 *
 *   node src/check-queries.mjs --db=test
 *
 * Read-only. The app's services import @react-native-firebase and cannot run
 * outside a simulator, so this mirrors their query shapes with the admin SDK.
 * It is not a substitute for exercising the app, but it catches the failure
 * mode that matters most before then: a MISSING COMPOSITE INDEX.
 *
 * That failure is worth catching early because v1 swallowed it — services
 * logged and returned [], so a missing index looked like "no events" rather
 * than an error.
 */
import { db, parseArgs } from "./admin.mjs";
import { C } from "./paths.mjs";

const args = parseArgs();
const target = args.targets[0];
const firestore = db(target);

// A company and user that actually exist, so the queries are realistic.
const companies = await firestore.collection(C.companies).limit(1).get();
if (companies.empty) {
	console.error(`No v2 companies in "${target}" — run the migration first.`);
	process.exit(1);
}
const companyId = companies.docs[0].id;

const members = await firestore
	.collection(C.memberships)
	.where("companyId", "==", companyId)
	.limit(1)
	.get();
const userId = members.empty ? "nobody" : members.docs[0].data().userId;

const events = await firestore
	.collection(C.events)
	.where("companyId", "==", companyId)
	.limit(1)
	.get();
const eventId = events.empty ? "none" : events.docs[0].id;

const FROM = "2020-01-01";
const TO = "2030-12-31";

const shapes = [
	[
		"membershipService.subscribeMembers",
		() =>
			firestore
				.collection(C.memberships)
				.where("companyId", "==", companyId)
				.where("status", "==", "active")
				.orderBy("lastName")
				.limit(500),
	],
	[
		"membershipService.getMembershipsForUser",
		() =>
			firestore
				.collection(C.memberships)
				.where("userId", "==", userId)
				.where("status", "==", "active")
				.limit(50),
	],
	[
		"eventService ALL",
		() =>
			firestore
				.collection(C.events)
				.where("companyId", "==", companyId)
				.where("dateKey", ">=", FROM)
				.where("dateKey", "<=", TO)
				.orderBy("dateKey")
				.limit(300),
	],
	[
		"eventService MY (array-contains)",
		() =>
			firestore
				.collection(C.events)
				.where("companyId", "==", companyId)
				.where("assignedUserIds", "array-contains", userId)
				.where("dateKey", ">=", FROM)
				.where("dateKey", "<=", TO)
				.orderBy("dateKey")
				.limit(300),
	],
	[
		"eventService UNASSIGNED (assignedCount)",
		() =>
			firestore
				.collection(C.events)
				.where("companyId", "==", companyId)
				.where("assignedCount", "==", 0)
				.where("dateKey", ">=", FROM)
				.where("dateKey", "<=", TO)
				.orderBy("dateKey")
				.limit(300),
	],
	[
		"eventService SPECIFIC (array-contains-any)",
		() =>
			firestore
				.collection(C.events)
				.where("companyId", "==", companyId)
				.where("assignedUserIds", "array-contains-any", [userId])
				.where("dateKey", ">=", FROM)
				.where("dateKey", "<=", TO)
				.orderBy("dateKey")
				.limit(300),
	],
	[
		"eventService.subscribeEventResponses",
		() =>
			firestore
				.collection(C.eventResponses)
				.where("companyId", "==", companyId)
				.where("eventId", "==", eventId)
				.limit(100),
	],
	[
		"timeEntryService.subscribeActiveEntry",
		() =>
			firestore
				.collection(C.timeEntries)
				.where("companyId", "==", companyId)
				.where("userId", "==", userId)
				.where("status", "in", ["active", "paused"])
				.limit(1),
	],
	[
		"timeEntryService per-user + range",
		() =>
			firestore
				.collection(C.timeEntries)
				.where("companyId", "==", companyId)
				.where("userId", "==", userId)
				.where("dateKey", ">=", FROM)
				.where("dateKey", "<=", TO)
				.orderBy("dateKey", "desc")
				.limit(100),
	],
	[
		"timeEntryService payroll (all users + range)",
		() =>
			firestore
				.collection(C.timeEntries)
				.where("companyId", "==", companyId)
				.where("dateKey", ">=", FROM)
				.where("dateKey", "<=", TO)
				.orderBy("dateKey", "desc")
				.limit(100),
	],
	[
		"timeEntryService by status + range",
		() =>
			firestore
				.collection(C.timeEntries)
				.where("companyId", "==", companyId)
				.where("status", "in", ["pending_approval"])
				.where("dateKey", ">=", FROM)
				.where("dateKey", "<=", TO)
				.orderBy("dateKey", "desc")
				.limit(100),
	],
	[
		"attachmentService.getAttachmentsForParent",
		() =>
			firestore
				.collection(C.attachments)
				.where("companyId", "==", companyId)
				.where("parentType", "==", "event")
				.where("parentId", "==", eventId)
				.limit(100),
	],
	[
		"libraryService.subscribeChecklists",
		() =>
			firestore
				.collection(C.checklists)
				.where("companyId", "==", companyId)
				.orderBy("updatedAt", "desc")
				.limit(200),
	],
	[
		"libraryService.subscribePackages",
		() =>
			firestore
				.collection(C.packages)
				.where("companyId", "==", companyId)
				.orderBy("title")
				.limit(200),
	],
	[
		"libraryService.subscribeEventLabels",
		() =>
			firestore
				.collection(C.eventLabels)
				.where("companyId", "==", companyId)
				.orderBy("name")
				.limit(200),
	],
	[
		"formSchemaService.getActiveSchema",
		() =>
			firestore
				.collection(C.formSchemas)
				.where("companyId", "==", companyId)
				.where("kind", "==", "eventForm")
				.orderBy("version", "desc")
				.limit(1),
	],
	[
		"companyService.findByAccessCode",
		() =>
			firestore
				.collection(C.companies)
				.where("accessCode", "==", "x")
				.limit(1),
	],
];

console.log(`Checking ${shapes.length} v2 query shapes against "${target}"\n`);
console.log(`  company: ${companyId}   user: ${userId}   event: ${eventId}\n`);

const missing = [];

for (const [label, build] of shapes) {
	try {
		const snap = await build().get();
		console.log(`  ok    ${label.padEnd(46)} ${snap.size} docs`);
	} catch (e) {
		const needsIndex =
			e?.code === 9 ||
			/FAILED_PRECONDITION|requires an index/i.test(e?.message ?? "");
		if (needsIndex) {
			const url =
				(e.message.match(/https:\/\/\S+/) ?? [])[0] ?? "(no url)";
			console.log(`  INDEX ${label.padEnd(46)} missing composite index`);
			missing.push({ label, url });
		} else {
			console.log(`  FAIL  ${label.padEnd(46)} ${e?.message ?? e}`);
			missing.push({ label, url: `ERROR: ${e?.message}` });
		}
	}
}

if (missing.length) {
	console.log(`\n${missing.length} query shape(s) need attention:\n`);
	for (const m of missing) console.log(`  ${m.label}\n    ${m.url}\n`);
	console.log(
		"Create these by deploying firestore.indexes.json (merged with the\n" +
			"production capture first), or by opening the URLs above.",
	);
	process.exit(1);
}

console.log(
	"\nAll query shapes resolve. Every index the v2 services need exists.",
);
process.exit(0);
