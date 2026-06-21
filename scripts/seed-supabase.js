#!/usr/bin/env node

/**
 * Seed a Supabase project with a synthetic catering company so the admin web
 * console has realistic data: employees, a two-week schedule with assigned
 * workers, and a payroll queue (approved / pending / active time entries).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-supabase.js
 *
 * Idempotent-ish: skips users whose email already exists. Safe to re-run; it
 * does not delete existing data.
 */

const { createClient } = require("@supabase/supabase-js");
const { randomUUID } = require("crypto");

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
	console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
	process.exit(1);
}
const supabase = createClient(URL, KEY, {
	auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "Password123!"; // dev only
const EMPLOYEES = [
	{
		first: "Olivia",
		last: "Owner",
		role: "owner",
		email: "olivia@catering.dev",
	},
	{
		first: "Marcus",
		last: "Manager",
		role: "manager",
		email: "marcus@catering.dev",
	},
	{
		first: "Jordan",
		last: "Reyes",
		role: "employee",
		email: "jordan@catering.dev",
	},
	{
		first: "Priya",
		last: "Shah",
		role: "employee",
		email: "priya@catering.dev",
	},
	{
		first: "Diego",
		last: "Lopez",
		role: "employee",
		email: "diego@catering.dev",
	},
	{ first: "Sam", last: "Chen", role: "employee", email: "sam@catering.dev" },
];

const iso = (d) => d.toISOString();
const addDays = (n) => {
	const d = new Date();
	d.setDate(d.getDate() + n);
	return d;
};
const at = (dayOffset, hour) => {
	const d = addDays(dayOffset);
	d.setHours(hour, 0, 0, 0);
	return d;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const ymd = (d) => d.toISOString().slice(0, 10);

async function ensureUser(emp) {
	// Look for an existing auth user with this email.
	const { data: list } = await supabase.auth.admin.listUsers();
	const existing = list?.users?.find((u) => u.email === emp.email);
	if (existing) return existing.id;

	const { data, error } = await supabase.auth.admin.createUser({
		email: emp.email,
		password: PASSWORD,
		email_confirm: true,
		user_metadata: { first_name: emp.first, last_name: emp.last },
	});
	if (error) throw new Error(`create ${emp.email}: ${error.message}`);
	return data.user.id;
}

async function main() {
	console.log("Seeding anthill dev data…");

	// Company + settings
	const companyId = randomUUID();
	await supabase.from("companies").insert({
		id: companyId,
		name: "Bayside Catering Co.",
		access_code: "BAYSIDE2026",
	});
	await supabase.from("company_settings").insert({
		company_id: companyId,
		enable_timesheet: true,
		enable_availability: true,
	});

	// Users (auth + membership) — the auth trigger creates the profile rows.
	const ids = {};
	for (const emp of EMPLOYEES) {
		const uid = await ensureUser(emp);
		ids[emp.email] = uid;
		await supabase
			.from("users")
			.update({ active_company_id: companyId })
			.eq("id", uid);
		await supabase
			.from("company_members")
			.upsert(
				{ company_id: companyId, user_id: uid, role: emp.role },
				{ onConflict: "company_id,user_id" },
			);
	}
	const employeeIds = EMPLOYEES.filter((e) => e.role === "employee").map(
		(e) => ids[e.email],
	);
	console.log(`  ${EMPLOYEES.length} users`);

	// Labels
	const labels = [
		{ id: randomUUID(), name: "Wedding", color: "#C26543" },
		{ id: randomUUID(), name: "Corporate", color: "#2F3B16" },
		{ id: randomUUID(), name: "Private", color: "#6B8E23" },
	].map((l) => ({ ...l, company_id: companyId }));
	await supabase.from("event_labels").insert(labels);

	// Events across the next two weeks, with assigned workers.
	const eventDefs = [
		{ title: "Harborview Wedding", day: 1, start: 15, end: 23, label: 0 },
		{ title: "TechCorp Mixer", day: 2, start: 17, end: 21, label: 1 },
		{ title: "Anniversary Dinner", day: 4, start: 18, end: 22, label: 2 },
		{ title: "Product Launch Gala", day: 6, start: 16, end: 23, label: 1 },
		{ title: "Garden Wedding", day: 9, start: 14, end: 22, label: 0 },
		{ title: "Board Luncheon", day: 11, start: 11, end: 15, label: 1 },
	];
	const eventRows = [];
	const workerRows = [];
	for (const e of eventDefs) {
		const eventId = randomUUID();
		const startAt = at(e.day, e.start);
		const endAt = at(e.day, e.end);
		eventRows.push({
			id: eventId,
			company_id: companyId,
			title: e.title,
			event_date: ymd(startAt),
			start_at: iso(startAt),
			end_at: iso(endAt),
			address: pick([
				"120 Harbor Way",
				"500 Market St",
				"88 Vineyard Ln",
				"1 Civic Plaza",
			]),
			label_id: labels[e.label].id,
			notes_workers: "Arrive 30 min early for setup.",
		});
		// Assign 2-3 employees with mixed statuses.
		const assigned = [...employeeIds]
			.sort(() => Math.random() - 0.5)
			.slice(0, 2 + (e.day % 2));
		for (const uid of assigned) {
			workerRows.push({
				event_id: eventId,
				user_id: uid,
				status: pick(["confirmed", "confirmed", "pending", "declined"]),
				hourly_rate: pick([22, 24, 26, 28]),
				role_at_event: pick(["Server", "Bartender", "Lead", "Prep"]),
			});
		}
	}
	await supabase.from("events").insert(eventRows);
	await supabase.from("event_workers").insert(workerRows);
	console.log(
		`  ${eventRows.length} events, ${workerRows.length} assignments`,
	);

	// Time entries — a payroll queue with a mix of statuses.
	const entryRows = [];
	for (let i = 0; i < 14; i++) {
		const uid = pick(employeeIds);
		const dayOffset = -(i % 10) - 1; // past shifts
		const start = at(dayOffset, 9 + (i % 4));
		const hours = 4 + (i % 5);
		const end = new Date(start.getTime() + hours * 3600 * 1000);
		const status = pick([
			"approved",
			"approved",
			"pending_approval",
			"pending_approval",
			"completed",
		]);
		entryRows.push({
			id: randomUUID(),
			company_id: companyId,
			user_id: uid,
			clock_in_at: iso(start),
			clock_out_at: iso(end),
			duration_seconds: hours * 3600,
			status,
			submitted_at: status !== "completed" ? iso(end) : null,
			approved_by:
				status === "approved" ? ids["marcus@catering.dev"] : null,
			approved_at: status === "approved" ? iso(end) : null,
		});
	}
	// One active clock-in right now.
	entryRows.push({
		id: randomUUID(),
		company_id: companyId,
		user_id: employeeIds[0],
		clock_in_at: iso(at(0, 9)),
		status: "active",
	});
	await supabase.from("time_entries").insert(entryRows);
	console.log(`  ${entryRows.length} time entries`);

	console.log(
		`\nDone. Company "Bayside Catering Co." — sign in with any seeded ` +
			`email (e.g. marcus@catering.dev) / ${PASSWORD}`,
	);
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
