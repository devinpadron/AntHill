/*
 * Finds membership inconsistencies that the old allow-all rules were masking.
 *
 *   node src/audit-memberships.mjs --db=prod
 *
 * Read-only. Never writes.
 *
 * v1 stores membership in two places, maintained by two non-atomic writes
 * (companyService.ts addUserToCompany / removeUserFromCompany):
 *
 *   Users/{uid}.companies[]              <->  Companies/{cid}/Users/{uid}
 *
 * If either write failed, the two disagree. Under the previous allow-all rules
 * that was invisible. Under the new rules, membership is decided SOLELY by the
 * Companies/{cid}/Users/{uid} document — so a user listing a company in
 * `companies[]` with no membership document now sees an empty company.
 *
 * This reports:
 *   ORPHAN_ARRAY  — in companies[], no membership doc  -> user LOSES ACCESS
 *   ORPHAN_DOC    — membership doc, not in companies[] -> company hidden in UI
 *   LEGACY_SHAPE  — companies is a map, not an array (dbMigrationUtils never ran)
 *   LEGACY_ROLE   — role is capitalized ("Owner"/"Admin")
 */
import { db, parseArgs } from "./admin.mjs";

const args = parseArgs();
const target = args.targets[0];
const firestore = db(target);

console.log(`Auditing memberships in "${target}"...\n`);

const [usersSnap, companiesSnap] = await Promise.all([
	firestore.collection("Users").get(),
	firestore.collection("Companies").get(),
]);

// companyId -> Set(userId) from the subcollection side
const membershipDocs = new Map();
const legacyRoles = [];

for (const company of companiesSnap.docs) {
	const members = await company.ref.collection("Users").get();
	const ids = new Set();

	for (const member of members.docs) {
		ids.add(member.id);
		const role = member.data()?.role;
		if (typeof role === "string" && role !== role.toLowerCase()) {
			legacyRoles.push({
				companyId: company.id,
				userId: member.id,
				role,
			});
		}
	}

	membershipDocs.set(company.id, ids);
}

const orphanArray = [];
const orphanDoc = [];
const legacyShape = [];

for (const user of usersSnap.docs) {
	const data = user.data() ?? {};
	const raw = data.companies;

	let companyIds = [];
	if (Array.isArray(raw)) {
		companyIds = raw;
	} else if (raw && typeof raw === "object") {
		legacyShape.push({ userId: user.id, companies: Object.keys(raw) });
		companyIds = Object.keys(raw);
	}

	for (const companyId of companyIds) {
		const ids = membershipDocs.get(companyId);
		if (!ids) {
			orphanArray.push({
				userId: user.id,
				companyId,
				reason: "company does not exist",
			});
		} else if (!ids.has(user.id)) {
			orphanArray.push({
				userId: user.id,
				companyId,
				reason: "no membership document",
			});
		}
	}

	for (const [companyId, ids] of membershipDocs) {
		if (ids.has(user.id) && !companyIds.includes(companyId)) {
			orphanDoc.push({ userId: user.id, companyId });
		}
	}
}

const report = (title, rows, detail) => {
	console.log(`${title}: ${rows.length}`);
	for (const row of rows.slice(0, 25)) console.log(`   ${detail(row)}`);
	if (rows.length > 25) console.log(`   ...and ${rows.length - 25} more`);
	console.log("");
};

console.log(`Users: ${usersSnap.size}   Companies: ${companiesSnap.size}\n`);

report(
	"ORPHAN_ARRAY (user LOSES ACCESS under the new rules)",
	orphanArray,
	(r) => `${r.userId} -> ${r.companyId} (${r.reason})`,
);
report(
	"ORPHAN_DOC (membership exists but company hidden in the UI)",
	orphanDoc,
	(r) => `${r.userId} -> ${r.companyId}`,
);
report(
	"LEGACY_SHAPE (companies is a map, not an array)",
	legacyShape,
	(r) => `${r.userId} -> ${r.companies.join(", ")}`,
);
report(
	"LEGACY_ROLE (capitalized role — the rules allow these on purpose)",
	legacyRoles,
	(r) => `${r.userId} in ${r.companyId} = "${r.role}"`,
);

if (orphanArray.length > 0) {
	console.log(
		"ACTION: ORPHAN_ARRAY users cannot see that company any more.\n" +
			"Fix by creating the missing Companies/{cid}/Users/{uid} document\n" +
			"with the correct role, or by removing the stale companies[] entry.",
	);
}

process.exit(0);
