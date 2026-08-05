import {
	membershipId,
	formSchemaHash,
	formSchemaId,
} from "../primitives/ids.mjs";

const SCHEMA_VERSION = 2;

/** Users/{uid} -> users/{uid}. Membership moves out entirely. */
export function transformUser(id, v1) {
	const email = v1.email ?? "";
	return {
		doc: {
			id,
			firstName: v1.firstName ?? "",
			lastName: v1.lastName ?? "",
			email,
			emailLower: email.toLowerCase(),
			phone: v1.phone ?? null,
			loggedInCompanyId: v1.loggedInCompany ?? null,
			fcmTokens: Array.isArray(v1.fcmToken)
				? v1.fcmToken.filter(Boolean)
				: v1.fcmToken
					? [v1.fcmToken]
					: [],
			lastSeenAppVersion: v1.lastSeenAppVersion ?? null,
			lastSeenAt: null,
			createdAt: null,
			updatedAt: null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues: v1.id ? [] : [{ id, code: "USER_ID_FIELD_MISSING" }],
	};
}

const ROLE_MAP = {
	owner: "owner",
	manager: "manager",
	user: "user",
	// dbMigrationUtils was meant to normalize these and never ran. Production
	// currently has zero, but the mapping costs nothing and cannot regress.
	Owner: "owner",
	Admin: "manager",
	Manager: "manager",
	User: "user",
};

export const normalizeRole = (raw) => ROLE_MAP[raw] ?? "user";

/**
 * Users.companies[] + Companies/{cid}/Users/{uid} -> memberships/{cid}_{uid}
 *
 * Collapses v1's bidirectional membership, which two non-atomic writes kept in
 * sync and could orphan either way. The denormalized profile fields are what
 * let a member list load in one query instead of an N+1 fan-out.
 */
export function transformMembership({
	companyId,
	userId,
	membershipDoc,
	userDoc,
}) {
	const issues = [];
	if (!membershipDoc) {
		issues.push({
			id: membershipId(companyId, userId),
			code: "MEMBERSHIP_DOC_MISSING",
			detail: "listed in companies[] with no membership document",
		});
	}
	if (!userDoc) {
		issues.push({
			id: membershipId(companyId, userId),
			code: "MEMBERSHIP_USER_MISSING",
		});
	}

	return {
		doc: {
			id: membershipId(companyId, userId),
			companyId,
			userId,
			role: normalizeRole(membershipDoc?.role),
			firstName: userDoc?.firstName ?? "",
			lastName: userDoc?.lastName ?? "",
			email: userDoc?.email ?? "",
			phone: userDoc?.phone ?? null,
			status: "active",
			joinedAt: null,
			createdAt: null,
			updatedAt: null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues,
	};
}

export function transformCompany(id, v1, timeZone) {
	return {
		doc: {
			id,
			name: v1.name ?? "",
			accessCode: v1.accessCode ?? "",
			timeZone,
			createdAt: null,
			updatedAt: null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues: [],
	};
}

/**
 * Settings/preferences -> companyPreferences/{cid}, with the two inline form
 * schemas replaced by references to deduped formSchemas documents.
 */
export function transformPreferences(companyId, v1, ctx) {
	const p = v1 ?? {};
	const eventSchema = ctx?.schemaIdFor?.("eventForm", p.eventForm) ?? null;
	const entrySchema =
		ctx?.schemaIdFor?.("timeEntryForm", p.timeEntryForm) ?? null;

	return {
		doc: {
			companyId,
			workWeekStarts: p.workWeekStarts ?? "sunday",
			allowUserEventEditing: p.allowUserEventEditing === true,
			canViewEventLabels: p.canViewEventLabels === true,
			enableTimeSheet: p.enableTimeSheet === true,
			enableAvailability: p.enableAvailability === true,
			availabilityReminder: {
				enabled: p.availabilityReminderEnabled === true,
				hours: p.availabilityReminderHours ?? 0,
				minutes: p.availabilityReminderMinutes ?? 0,
			},
			eventFormSchemaId: eventSchema?.id ?? null,
			timeEntryFormSchemaId: entrySchema?.id ?? null,
			updatedAt: null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues: v1 ? [] : [{ id: companyId, code: "PREFERENCES_MISSING" }],
	};
}

/**
 * Collects every distinct form schema — from company preferences AND from the
 * copies embedded in each time entry — into immutable, versioned documents.
 *
 * Production embeds a schema in 2,202 time entries; deduping by content hash
 * collapses those to a handful of documents that entries then reference.
 */
export function createSchemaRegistry(companyId) {
	/** @type {Map<string, {id, hash, kind, version, schema}>} */
	const byHash = new Map();
	const counters = { eventForm: 0, timeEntryForm: 0 };

	return {
		/** Registers a schema (idempotent) and returns its `{id, hash}`. */
		register(kind, schema) {
			if (!schema || typeof schema !== "object") return null;
			const hash = formSchemaHash(schema);
			const existing = byHash.get(hash);
			if (existing) return { id: existing.id, hash };

			const version = ++counters[kind];
			const id = formSchemaId(companyId, kind, version);
			byHash.set(hash, { id, hash, kind, version, schema });
			return { id, hash };
		},

		/** Every registered schema, as formSchemas documents. */
		documents() {
			return [...byHash.values()].map(
				({ id, hash, kind, version, schema }) => ({
					id,
					companyId,
					kind,
					version,
					title: schema.title ?? "",
					description: schema.description ?? "",
					isEnabled: schema.isEnabled !== false,
					fields: normalizeFields(schema.fields ?? []),
					contentHash: hash,
					supersededBySchemaId: null,
					createdAt: null,
					createdBy: null,
					schemaVersion: SCHEMA_VERSION,
				}),
			);
		},
	};
}

/**
 * v1 allowed a legacy inline `options: string[]` on checklist fields instead of
 * a `checklistId`. Production has none, but the normalization is kept so a
 * stray one cannot slip through unnoticed.
 */
function normalizeFields(fields) {
	return fields.map((f) => {
		const field = {
			id: String(f.id ?? ""),
			label: f.label ?? "",
			type: f.type ?? "text",
			required: f.required === true,
		};
		if (f.unit) field.unit = f.unit;
		if (f.showTotal !== undefined) field.showTotal = f.showTotal === true;
		if (f.useMultiplier !== undefined)
			field.useMultiplier = f.useMultiplier === true;
		if (typeof f.multiplier === "number") field.multiplier = f.multiplier;
		if (Array.isArray(f.options) && f.type !== "checklist") {
			field.selectOptions = f.options;
		}
		if (f.checklistId) field.checklistId = f.checklistId;
		if (typeof f.checklistItemCount === "number") {
			field.checklistItemCount = f.checklistItemCount;
		}
		return field;
	});
}
