/*
 * How many users are on a build that can survive the cutover.
 *
 *   node src/adoption.mjs --db=prod
 *
 * Read-only. This is the gate for cutover timing: proceed when >= 95% of users
 * active in the last 14 days are on the minimum build.
 *
 * Reads users.lastSeenAppVersion / lastSeenAt, written on every launch by
 * LaunchTelemetry in App.tsx. Users last seen before that shipped report
 * "never" — they are not stragglers, they are simply unmeasured, and they age
 * out of the active window on their own.
 */
import { db, parseArgs } from "./admin.mjs";

const MIN_VERSION = "1.0.100";
const ACTIVE_DAYS = 14;

const args = parseArgs();
const target = args.targets[0];
const firestore = db(target);

/** Numeric comparison, so 1.0.100 sorts above 1.0.99 rather than below it. */
const cmp = (a, b) => {
	const pa = String(a).split(".").map(Number);
	const pb = String(b).split(".").map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d) return d;
	}
	return 0;
};

const snap = await firestore.collection("Users").get();
const cutoff = Date.now() - ACTIVE_DAYS * 86400 * 1000;

const versions = {};
let active = 0;
let activeOnMin = 0;
let never = 0;
const stragglers = [];

for (const doc of snap.docs) {
	const d = doc.data() ?? {};
	const version = d.lastSeenAppVersion ?? null;
	versions[version ?? "never"] = (versions[version ?? "never"] ?? 0) + 1;

	if (!version) {
		never += 1;
		continue;
	}

	const seenAt = Date.parse(d.lastSeenAt ?? "");
	if (!Number.isFinite(seenAt) || seenAt < cutoff) continue;

	active += 1;
	if (cmp(version, MIN_VERSION) >= 0) activeOnMin += 1;
	else
		stragglers.push({
			id: doc.id,
			email: d.email,
			version,
			seen: d.lastSeenAt,
		});
}

console.log(`Adoption in "${target}" — minimum build ${MIN_VERSION}\n`);

console.log("=== VERSION DISTRIBUTION (all users) ===");
for (const [v, n] of Object.entries(versions).sort((a, b) => b[1] - a[1])) {
	console.log(`  ${v.padEnd(14)} ${n}`);
}

/*
 * IMPORTANT: `lastSeenAppVersion` is only ever written by 1.0.100+, so a user
 * still on 1.0.98 who opens the app every day is indistinguishable from one who
 * deleted it — both report "never".
 *
 * That means the measured percentage is adoption among users we can SEE, and it
 * starts at 100% by construction. The number that matters is coverage of the
 * whole user base, so report against total users and treat "never" as unknown
 * rather than inactive.
 */
const total = snap.size;
const measuredPct = active ? Math.round((activeOnMin / active) * 100) : 0;
const coveragePct = total ? Math.round((activeOnMin / total) * 100) : 0;

console.log(`\n=== COVERAGE (what actually gates the cutover) ===`);
console.log(`  total users                 ${total}`);
console.log(`  confirmed on ${MIN_VERSION}+     ${activeOnMin}`);
console.log(`  coverage                    ${coveragePct}%`);
console.log(`  unmeasurable                ${never}  <- see note below`);

console.log(`\n=== MEASURED (among users reporting telemetry) ===`);
console.log(`  active in last ${ACTIVE_DAYS} days     ${active}`);
console.log(
	`  of those, on ${MIN_VERSION}+   ${activeOnMin}  (${measuredPct}%)`,
);
console.log(
	`\n  NOTE: telemetry only exists in ${MIN_VERSION}+. Users on older builds\n` +
		`  report "never" whether they are active daily or long gone, so the\n` +
		`  measured figure cannot fall below 100% and must not be used as the\n` +
		`  gate. For a version split that sees ALL builds, use Firebase console\n` +
		`  -> Crashlytics, which this app already reports to.`,
);

if (stragglers.length) {
	console.log(`\n=== STRAGGLERS (active but below ${MIN_VERSION}) ===`);
	for (const s of stragglers.slice(0, 20)) {
		console.log(
			`  ${(s.email ?? s.id).padEnd(38)} ${s.version}   ${s.seen}`,
		);
	}
	if (stragglers.length > 20) {
		console.log(`  ...and ${stragglers.length - 20} more`);
	}
}

const ready = coveragePct >= 95;
console.log(
	`\n${
		ready
			? "READY — 95% of the user base confirmed on the minimum build."
			: `NOT READY — ${coveragePct}% coverage, need 95%. ` +
				`${never} users have not yet been seen on ${MIN_VERSION}+.`
	}`,
);
process.exit(0);
