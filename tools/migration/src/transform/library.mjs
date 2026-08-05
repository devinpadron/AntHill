import { toDate } from "../primitives/timestamps.mjs";

const SCHEMA_VERSION = 2;

const stamps = (v1) => {
	const created = toDate(v1.createdAt ?? null);
	const updated = toDate(v1.updatedAt ?? null);
	return {
		createdAt: created.ok ? created.value : null,
		updatedAt: updated.ok ? updated.value : null,
	};
};

/**
 * Companies/{cid}/Checklists/{id} -> checklists/{id}
 *
 * v1 allowed two item shapes: `string[]` (legacy) and `{id,text}[]`. Legacy
 * items get index-derived IDs, which are stable across re-runs — important,
 * because the event checklist STATE map is keyed by item id, and an unstable
 * id would orphan every tick. Production is entirely the modern shape.
 */
export function transformChecklist(id, v1, ctx) {
	const issues = [];
	const raw = Array.isArray(v1.items) ? v1.items : [];
	const items = [];

	raw.forEach((item, index) => {
		if (typeof item === "string") {
			issues.push({
				id,
				code: "CHECKLIST_LEGACY_STRING_ITEM",
				detail: index,
			});
			items.push({ id: `i${index}`, text: item });
		} else if (item && typeof item === "object") {
			if (!item.id) {
				issues.push({
					id,
					code: "CHECKLIST_ITEM_NO_ID",
					detail: index,
				});
			}
			items.push({
				id: String(item.id ?? `i${index}`),
				text: item.text ?? "",
			});
		}
	});

	if (!v1.title && v1.name) {
		issues.push({ id, code: "CHECKLIST_LEGACY_NAME_KEY" });
	}

	return {
		doc: {
			id,
			companyId: ctx.companyId,
			title: v1.title ?? v1.name ?? "",
			items,
			...stamps(v1),
			schemaVersion: SCHEMA_VERSION,
		},
		issues,
	};
}

/**
 * Companies/{cid}/Packages/{id} -> packages/{id}
 *
 * `checklists: [{checklistId}]` flattens to `checklistIds: string[]`. The
 * `quantity` field eventService looked for was never written and is dropped.
 */
export function transformPackage(id, v1, ctx) {
	const issues = [];
	const checklistIds = [];

	for (const entry of v1.checklists ?? []) {
		const cid = typeof entry === "string" ? entry : entry?.checklistId;
		if (!cid) continue;
		if (ctx.checklistIds && !ctx.checklistIds.has(cid)) {
			issues.push({
				id,
				code: "PACKAGE_CHECKLIST_DANGLING",
				detail: cid,
			});
			continue;
		}
		checklistIds.push(cid);
	}

	return {
		doc: {
			id,
			companyId: ctx.companyId,
			title: v1.title ?? "",
			description: v1.description ?? "",
			checklistIds,
			...stamps(v1),
			schemaVersion: SCHEMA_VERSION,
		},
		issues,
	};
}

/** Companies/{cid}/EventLabels/{id} -> eventLabels/{id} */
export function transformEventLabel(id, v1, ctx) {
	return {
		doc: {
			id,
			companyId: ctx.companyId,
			name: v1.name ?? v1.title ?? "",
			color: v1.color ?? "#808080",
			...stamps(v1),
			schemaVersion: SCHEMA_VERSION,
		},
		issues: [],
	};
}

/** Users/{uid}/Preferences/settings -> userSettings/{uid} */
export function transformUserSettings(userId, v1) {
	return {
		doc: {
			userId,
			preferredMapApp: v1?.preferredMapApp ?? "apple",
			defaultCalendarFilter: v1?.defaultCalendarFilter ?? "all",
			createdAt: null,
			updatedAt: null,
		},
		issues: [],
	};
}
