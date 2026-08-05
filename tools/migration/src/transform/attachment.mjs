import { toDate } from "../primitives/timestamps.mjs";
import { sha1 } from "../primitives/ids.mjs";

const SCHEMA_VERSION = 2;

/*
 * Attachments have TWO generations in production, confirmed by profiling:
 *
 *   modern (19 docs)  id, name, type, size, storageRef, downloadUrl,
 *                     thumbnailStorageRef, thumbnailUrl, createdAt
 *   legacy (13 docs)  id, name, type, path, url, uploadTime
 *                     (+ thumbnailPath, thumbnailUrl, duration on one video)
 *
 * The legacy generation is why 13 documents have no `storageRef` — the field
 * is simply called `path` there. Reading it as "missing" would have orphaned
 * those Storage objects.
 */

const STORAGE_PARENT = { event: "Events", timeEntry: "TimeEntries" };

/**
 * @param {object} ctx `{ companyId, parentType, parentId, ownerUserId, fieldId }`
 */
export function transformAttachment(id, v1, ctx) {
	const issues = [];
	const note = (code, detail) => issues.push({ id, code, detail });

	// Modern key first, then the legacy name, then derive from the known layout.
	let storagePath = v1.storageRef ?? v1.path ?? null;
	if (!storagePath) {
		const segment = STORAGE_PARENT[ctx.parentType];
		if (segment) {
			// NOTE the casing: lowercase "companies", PascalCase parent. Preserved
			// verbatim — every existing record points at it.
			storagePath = `companies/${ctx.companyId}/${segment}/${ctx.parentId}/${id}`;
			note("STORAGE_PATH_DERIVED", storagePath);
		}
	}

	const downloadUrl = v1.downloadUrl ?? v1.url ?? v1.uri ?? null;

	if (!storagePath && !downloadUrl) {
		note("ATTACHMENT_UNRECOVERABLE", Object.keys(v1 ?? {}));
		return { doc: null, issues };
	}

	const created = toDate(v1.createdAt ?? v1.uploadTime ?? null);

	return {
		doc: {
			id: id || sha1(storagePath ?? downloadUrl),
			companyId: ctx.companyId,
			parentType: ctx.parentType,
			parentId: ctx.parentId,
			ownerUserId: ctx.ownerUserId ?? null,
			fieldId: ctx.fieldId ?? null,
			fileName: v1.name ?? v1.filename ?? basename(storagePath) ?? "",
			contentType: v1.type ?? "application/octet-stream",
			sizeBytes: typeof v1.size === "number" ? v1.size : 0,
			width: v1.width ?? null,
			height: v1.height ?? null,
			storagePath,
			downloadUrl,
			thumbnailStoragePath:
				v1.thumbnailStorageRef ?? v1.thumbnailPath ?? null,
			thumbnailDownloadUrl: v1.thumbnailUrl ?? v1.thumbnailUri ?? null,
			storageVerifiedAt: null,
			createdAt: created.ok ? created.value : null,
			schemaVersion: SCHEMA_VERSION,
		},
		issues,
	};
}

const basename = (path) => (path ? path.split("/").pop() : null);
