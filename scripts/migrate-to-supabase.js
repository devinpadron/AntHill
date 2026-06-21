#!/usr/bin/env node

/**
 * Firestore -> Supabase migration job
 *
 * Ports a Firestore export (produced by export-firestore.js) into the Supabase
 * schema in supabase/migrations. Follows the mapping in DB_SCHEMA_DESIGN.md §10:
 * new UUIDs everywhere, `legacy_firestore_id` preserved on every row, and an
 * in-memory id map so foreign references resolve.
 *
 * Scope: processes ONE company end-to-end (per §12 step 3). Run it per company.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/migrate-to-supabase.js \
 *     --in scripts/firestore-export.json --company AntHill [--dry-run]
 *
 * Notes:
 *   - Uses the SERVICE ROLE key (bypasses RLS). Never ship this key to a client.
 *   - Auth users are created via the Admin API, which fires the auth->profile
 *     trigger; we then patch the profile rows. Firebase scrypt password import
 *     is a SEPARATE one-shot step (see DB_SCHEMA_DESIGN.md §10) — created users
 *     here have no password and must reset, unless you import hashes first.
 *   - Storage objects are not copied here; only attachment *metadata* rows are
 *     written. A separate pass should download from Firebase Storage and upload
 *     to the Supabase buckets, then backfill storage_path.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// --------------------------------------------------------------------------
// Args + client
// --------------------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (flag, def) => {
	const i = args.indexOf(flag);
	return i !== -1 && i + 1 < args.length ? args[i + 1] : def;
};
const DRY_RUN = args.includes("--dry-run");
const IN_FILE = getArg("--in", "scripts/firestore-export.json");
const COMPANY_NAME = getArg("--company", null);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_KEY)) {
	console.error(
		"Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or pass --dry-run).",
	);
	process.exit(1);
}

const supabase = DRY_RUN
	? null
	: createClient(SUPABASE_URL, SERVICE_KEY, {
			auth: { autoRefreshToken: false, persistSession: false },
		});

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
const idMap = new Map(); // firestoreId -> uuid
const remember = (firestoreId, uuid) => idMap.set(firestoreId, uuid);
const lookup = (firestoreId) => idMap.get(firestoreId) ?? null;

const { randomUUID } = require("crypto");
const newId = (firestoreId) => {
	const id = randomUUID();
	if (firestoreId) remember(firestoreId, id);
	return id;
};

let inserted = 0;
async function insert(table, rows) {
	const list = Array.isArray(rows) ? rows : [rows];
	if (list.length === 0) return;
	inserted += list.length;
	if (DRY_RUN) {
		console.log(`  [dry-run] insert ${list.length} into ${table}`);
		return;
	}
	// Chunk to keep payloads reasonable.
	for (let i = 0; i < list.length; i += 500) {
		const chunk = list.slice(i, i + 500);
		const { error } = await supabase.from(table).insert(chunk);
		if (error) {
			throw new Error(`insert ${table} failed: ${error.message}`);
		}
	}
}

// Combine a YYYY-MM-DD date with an "h:mm a"/ISO time into an ISO timestamp.
function toTimestamp(date, time) {
	if (!date) return null;
	if (!time) return new Date(`${date}T00:00:00`).toISOString();
	// Already ISO?
	if (/\d{4}-\d{2}-\d{2}T/.test(time)) return new Date(time).toISOString();
	const parsed = new Date(`${date} ${time}`);
	return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const TIME_ENTRY_STATUS = new Set([
	"active",
	"paused",
	"completed",
	"edited",
	"pending_approval",
	"approved",
	"rejected",
]);
const normalizeStatus = (s) => {
	const v = String(s ?? "").toLowerCase();
	if (v === "pendingapproval" || v === "pending") return "pending_approval";
	return TIME_ENTRY_STATUS.has(v) ? v : "completed";
};
const normalizeRole = (r) => {
	const v = String(r ?? "user").toLowerCase();
	if (v === "owner") return "owner";
	if (v === "manager") return "manager";
	return "employee"; // "user" -> "employee"
};
const normalizeWorkerStatus = (s) => {
	const v = String(s ?? "pending").toLowerCase();
	return ["pending", "confirmed", "declined"].includes(v) ? v : "pending";
};

// First location entry: { "123 Main St": { latitude, longitude } } or GeoPoint.
function firstLocation(locations) {
	if (!locations || typeof locations !== "object") return {};
	const key = Object.keys(locations)[0];
	if (!key) return {};
	const val = locations[key] || {};
	return {
		address: key,
		latitude: typeof val.latitude === "number" ? val.latitude : null,
		longitude: typeof val.longitude === "number" ? val.longitude : null,
	};
}

const sub = (doc, name) => (Array.isArray(doc?.[name]) ? doc[name] : []);
const findDoc = (arr, id) => (arr || []).find((d) => d._id === id);

// --------------------------------------------------------------------------
// Phases
// --------------------------------------------------------------------------
async function migrateCompany(company, allUsersById) {
	const companyId = newId(company._id);
	console.log(`\nCompany "${company.name}" (${company._id}) -> ${companyId}`);

	await insert("companies", {
		id: companyId,
		name: company.name ?? "Untitled",
		access_code: company.accessCode ?? company._id,
		legacy_firestore_id: company._id,
	});

	// company_settings (Settings/preferences)
	const prefs = findDoc(sub(company, "Settings"), "preferences") || {};
	await insert("company_settings", {
		company_id: companyId,
		work_week_starts:
			prefs.workWeekStarts === "monday" ? "monday" : "sunday",
		allow_user_event_editing: !!prefs.allowUserEventEditing,
		enable_timesheet: prefs.enableTimeSheet ?? true,
		enable_availability: prefs.enableAvailability ?? true,
		can_view_event_labels: prefs.canViewEventLabels ?? true,
		availability_reminder_enabled: !!prefs.availabilityReminderEnabled,
		availability_reminder_hours: prefs.availabilityReminderHours ?? null,
		availability_reminder_minutes:
			prefs.availabilityReminderMinutes ?? null,
		time_entry_form: prefs.timeEntryForm ?? {
			isEnabled: false,
			fields: [],
		},
		event_form: prefs.eventForm ?? { isEnabled: false, fields: [] },
	});

	// Members (Companies/{cid}/Users subcollection -> company_members).
	// Users themselves are created in migrateUsers(); here we only link.
	const memberRows = [];
	for (const m of sub(company, "Users")) {
		const userUuid = lookup(m._id);
		if (!userUuid) {
			console.warn(`  ! membership for unknown user ${m._id}, skipping`);
			continue;
		}
		memberRows.push({
			company_id: companyId,
			user_id: userUuid,
			role: normalizeRole(m.role),
		});
	}
	await insert("company_members", memberRows);

	// Event labels
	const labelRows = sub(company, "EventLabels").map((l) => ({
		id: newId(l._id),
		company_id: companyId,
		name: l.name ?? "Label",
		color: l.color ?? "#6B8E23",
		legacy_firestore_id: l._id,
	}));
	await insert("event_labels", labelRows);

	// Checklists (+ items)
	const checklistRows = [];
	const checklistItemRows = [];
	for (const c of sub(company, "Checklists")) {
		const clId = newId(c._id);
		checklistRows.push({
			id: clId,
			company_id: companyId,
			title: c.title ?? "Checklist",
			legacy_firestore_id: c._id,
		});
		(c.items || []).forEach((it, i) => {
			checklistItemRows.push({
				id: randomUUID(),
				checklist_id: clId,
				text: typeof it === "string" ? it : (it.text ?? ""),
				position: i,
			});
		});
	}
	await insert("checklists", checklistRows);
	await insert("checklist_items", checklistItemRows);

	// Packages (+ package_checklists)
	const packageRows = [];
	const packageChecklistRows = [];
	for (const p of sub(company, "Packages")) {
		const pkgId = newId(p._id);
		packageRows.push({
			id: pkgId,
			company_id: companyId,
			title: p.title ?? "Package",
			description: p.description ?? null,
			legacy_firestore_id: p._id,
		});
		(p.checklists || []).forEach((ref, i) => {
			const clLegacy = typeof ref === "string" ? ref : ref.checklistId;
			const clUuid = lookup(clLegacy);
			if (clUuid)
				packageChecklistRows.push({
					package_id: pkgId,
					checklist_id: clUuid,
					position: i,
				});
		});
	}
	await insert("packages", packageRows);
	await insert("package_checklists", packageChecklistRows);

	// Events (+ workers, packages, checklists/states, attachments)
	await migrateEvents(company, companyId);

	// Time entries (+ edits, events, attachments)
	await migrateTimeEntries(company, companyId);
}

async function migrateEvents(company, companyId) {
	const eventRows = [];
	const workerRows = [];
	const eventPackageRows = [];
	const eventChecklistRows = [];
	const itemStateRows = [];
	const attachmentRows = [];

	for (const e of sub(company, "Events")) {
		const eventId = newId(e._id);
		const loc = firstLocation(e.locations);
		eventRows.push({
			id: eventId,
			company_id: companyId,
			title: e.title ?? "Event",
			event_date: e.date ?? null,
			start_at:
				toTimestamp(e.date, e.startTime) ?? new Date().toISOString(),
			end_at: toTimestamp(e.date, e.endTime),
			is_all_day: !!e.isAllDay,
			address: loc.address ?? null,
			latitude: loc.latitude ?? null,
			longitude: loc.longitude ?? null,
			notes_workers: e.notes ?? null,
			notes_admin: e.notesAdmin ?? null,
			label_id: lookup(e.labelId) ?? null,
			form_responses: e.formResponses ?? {},
			created_by: lookup(e.createdBy) ?? null,
			legacy_firestore_id: e._id,
		});

		// assignedWorkers[] + workerStatus{} -> event_workers
		const status = e.workerStatus || {};
		for (const uid of e.assignedWorkers || []) {
			const userUuid = lookup(uid);
			if (!userUuid) continue;
			workerRows.push({
				event_id: eventId,
				user_id: userUuid,
				status: normalizeWorkerStatus(status[uid]),
			});
		}

		// packages[] -> event_packages (string id or { id, quantity })
		for (const ref of e.packages || []) {
			const pkgLegacy = typeof ref === "string" ? ref : ref.id;
			const pkgUuid = lookup(pkgLegacy);
			if (pkgUuid)
				eventPackageRows.push({
					event_id: eventId,
					package_id: pkgUuid,
					quantity: (typeof ref === "object" && ref.quantity) || 1,
				});
		}

		// Per-event Checklists subcollection -> event_checklists + states.
		// Each doc id is a checklist id; its fields map item id -> state (0/1/2).
		for (const cl of sub(e, "Checklists")) {
			const clUuid = lookup(cl._id);
			if (!clUuid) continue;
			eventChecklistRows.push({
				event_id: eventId,
				checklist_id: clUuid,
			});
			for (const [itemKey, state] of Object.entries(cl)) {
				if (itemKey === "_id") continue;
				if (typeof state !== "number") continue;
				const itemUuid = lookup(itemKey);
				if (!itemUuid) continue; // item id map may not cover legacy item ids
				itemStateRows.push({
					event_id: eventId,
					checklist_item_id: itemUuid,
					state: [0, 1, 2].includes(state) ? state : 0,
				});
			}
		}

		// Attachments subcollection
		for (const a of sub(e, "Attachments")) {
			attachmentRows.push(attachmentRow(a, companyId, "event", eventId));
		}
	}

	await insert("events", eventRows);
	await insert("event_workers", workerRows);
	await insert("event_packages", eventPackageRows);
	await insert("event_checklists", eventChecklistRows);
	await insert("event_checklist_item_states", itemStateRows);
	await insert("attachments", attachmentRows.filter(Boolean));
}

async function migrateTimeEntries(company, companyId) {
	const entryRows = [];
	const editRows = [];
	const teEventRows = [];
	const attachmentRows = [];

	for (const t of sub(company, "TimeEntries")) {
		const userUuid = lookup(t.userId);
		if (!userUuid) {
			console.warn(
				`  ! time entry ${t._id} for unknown user ${t.userId}`,
			);
			continue;
		}
		const entryId = newId(t._id);
		entryRows.push({
			id: entryId,
			company_id: companyId,
			user_id: userUuid,
			clock_in_at: t.clockInTime
				? new Date(t.clockInTime).toISOString()
				: null,
			clock_out_at: t.clockOutTime
				? new Date(t.clockOutTime).toISOString()
				: null,
			duration_seconds: t.duration ?? null,
			status: normalizeStatus(t.status),
			pause_start_at: t.pauseStartTime
				? new Date(t.pauseStartTime).toISOString()
				: null,
			total_paused_seconds: t.totalPausedSeconds ?? 0,
			notes: t.notes ?? null,
			submission_notes: t.submissionNotes ?? null,
			form_responses: t.formResponses ?? {},
			submitted_at: t.submittedAt
				? new Date(t.submittedAt).toISOString()
				: null,
			approved_by: lookup(t.approvedBy) ?? null,
			approved_at: t.approvedAt
				? new Date(t.approvedAt).toISOString()
				: null,
			rejected_by: lookup(t.rejectedBy) ?? null,
			rejected_at: t.rejectedAt
				? new Date(t.rejectedAt).toISOString()
				: null,
			rejection_reason: t.rejectionReason ?? null,
			legacy_firestore_id: t._id,
		});

		// editHistory[] -> time_entry_edits
		for (const h of t.editHistory || []) {
			const editorUuid = lookup(h.editedBy) ?? userUuid;
			editRows.push({
				id: randomUUID(),
				time_entry_id: entryId,
				edited_by: editorUuid,
				edited_at: h.editedAt
					? new Date(h.editedAt).toISOString()
					: new Date().toISOString(),
				previous_clock_in_at: h.previousClockIn
					? new Date(h.previousClockIn).toISOString()
					: null,
				previous_clock_out_at: h.previousClockOut
					? new Date(h.previousClockOut).toISOString()
					: null,
				previous_duration_seconds: h.previousDuration ?? null,
				previous_notes: h.previousNotes ?? null,
				summary: h.summary ?? null,
			});
		}

		// connectedEvents[] -> time_entry_events
		for (const ce of t.connectedEvents || []) {
			const evLegacy = typeof ce === "string" ? ce : ce.eventId;
			const evUuid = lookup(evLegacy);
			if (!evUuid) continue;
			teEventRows.push({
				time_entry_id: entryId,
				event_id: evUuid,
				overlap_start:
					(ce.overlapStart &&
						new Date(ce.overlapStart).toISOString()) ||
					entryRows[entryRows.length - 1].clock_in_at,
				overlap_end:
					(ce.overlapEnd && new Date(ce.overlapEnd).toISOString()) ||
					entryRows[entryRows.length - 1].clock_out_at ||
					entryRows[entryRows.length - 1].clock_in_at,
			});
		}

		for (const a of sub(t, "Attachments")) {
			attachmentRows.push(
				attachmentRow(a, companyId, "time_entry", entryId),
			);
		}
	}

	await insert("time_entries", entryRows);
	await insert("time_entry_edits", editRows);
	await insert(
		"time_entry_events",
		teEventRows.filter((r) => r.overlap_start),
	);
	await insert("attachments", attachmentRows.filter(Boolean));
}

function attachmentRow(a, companyId, targetType, targetId) {
	if (!a) return null;
	return {
		id: randomUUID(),
		company_id: companyId,
		target_type: targetType,
		target_id: targetId,
		name: a.name ?? "file",
		mime_type: a.type ?? a.mimeType ?? "application/octet-stream",
		size_bytes: a.size ?? 0,
		width: a.width ?? null,
		height: a.height ?? null,
		// storage_path is backfilled by the separate file-copy pass; keep the
		// legacy ref so it can be matched up.
		storage_path:
			a.storageRef ?? a.storagePath ?? `legacy/${a._id ?? a.id}`,
		thumbnail_path: a.thumbnailStorageRef ?? null,
		uploaded_by: lookup(a.uploadedBy) ?? null,
	};
}

// Create auth users (fires the profile trigger), then patch profile extras.
async function migrateUsers(users) {
	const fcmRows = [];
	const prefRows = [];
	for (const u of users) {
		let uuid;
		if (DRY_RUN) {
			uuid = newId(u._id);
		} else {
			const { data, error } = await supabase.auth.admin.createUser({
				email: u.email,
				email_confirm: true,
				user_metadata: {
					first_name: u.firstName ?? "",
					last_name: u.lastName ?? "",
				},
			});
			if (error) {
				console.warn(
					`  ! create auth user ${u.email}: ${error.message}`,
				);
				continue;
			}
			uuid = data.user.id;
			remember(u._id, uuid);
		}

		// Patch the profile row the trigger created.
		if (!DRY_RUN) {
			const { error } = await supabase
				.from("users")
				.update({
					phone: u.phone ?? null,
					legacy_firestore_id: u._id,
				})
				.eq("id", uuid);
			if (error)
				console.warn(`  ! patch user ${u._id}: ${error.message}`);
		}

		// fcm tokens
		for (const token of u.fcmToken || []) {
			if (token) fcmRows.push({ user_id: uuid, token, platform: "ios" });
		}

		// preferences (Preferences/settings subcollection -> prefs JSONB)
		const settings = findDoc(sub(u, "Preferences"), "settings");
		if (settings) {
			const { _id, ...prefs } = settings;
			prefRows.push({ user_id: uuid, prefs });
		}
	}
	await insert("fcm_tokens", fcmRows);
	// user_preferences rows already exist (trigger); upsert the prefs bag.
	if (!DRY_RUN && prefRows.length) {
		const { error } = await supabase
			.from("user_preferences")
			.upsert(prefRows, { onConflict: "user_id" });
		if (error) console.warn(`  ! user_preferences: ${error.message}`);
	}
}

// Backfill active_company_id after companies + users exist.
async function backfillActiveCompany(users) {
	for (const u of users) {
		const uuid = lookup(u._id);
		const companyUuid = lookup(u.loggedInCompany);
		if (!uuid || !companyUuid) continue;
		if (DRY_RUN) continue;
		await supabase
			.from("users")
			.update({ active_company_id: companyUuid })
			.eq("id", uuid);
	}
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function main() {
	const raw = fs.readFileSync(path.resolve(IN_FILE), "utf-8");
	const data = JSON.parse(raw);

	const companies = data.Companies || [];
	const users = data.Users || [];

	const targets = COMPANY_NAME
		? companies.filter(
				(c) => c.name === COMPANY_NAME || c._id === COMPANY_NAME,
			)
		: companies;
	if (targets.length === 0) {
		console.error(`No company matched "${COMPANY_NAME}".`);
		process.exit(1);
	}

	// Only the users that belong to the targeted companies.
	const targetCompanyIds = new Set(targets.map((c) => c._id));
	const targetUsers = users.filter((u) =>
		(u.companies || []).some((cid) => targetCompanyIds.has(cid)),
	);

	console.log(
		`Migrating ${targets.length} company(ies), ${targetUsers.length} user(s)` +
			(DRY_RUN ? " [DRY RUN]" : ""),
	);

	// Order matters: users (auth) first so memberships/events/time-entries can
	// resolve user ids; then each company and its entities; then the
	// active-company backfill once both company and user ids exist.
	await migrateUsers(targetUsers);

	for (const c of targets) {
		await migrateCompany(c, targetUsers);
	}

	await backfillActiveCompany(targetUsers);

	console.log(
		`\nDone. ${inserted} row(s) ${DRY_RUN ? "would be " : ""}inserted.`,
	);
	console.log(
		"Reminder: import Firebase scrypt password hashes and copy Storage " +
			"objects separately (see DB_SCHEMA_DESIGN.md §10).",
	);
}

main().catch((err) => {
	console.error("Migration failed:", err);
	process.exit(1);
});
