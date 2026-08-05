import firestore from "@react-native-firebase/firestore";
import db from "../../lib/db";
import { C } from "../../constants/paths";
import { FormSchema, FormField } from "../../types/v2";

/*
 * Company form schemas.
 *
 * v1 embedded TWO complete schema copies in every submitted time entry so that
 * historical entries could still render — 4,087 copies of what turned out to be
 * 39 distinct schemas.
 *
 * v2 gets the same guarantee for free by making schema documents IMMUTABLE:
 * editing a form publishes a new version and repoints the preference; nothing
 * ever mutates a published schema. A reference to an immutable document is
 * exactly as durable as an embedded copy. The security rules enforce this
 * (`allow update, delete: if false`), so it cannot be undone by a future bug.
 */

const SCHEMA_LIMIT = 50;

/**
 * Immutable, so caching forever is correct rather than merely convenient.
 * A payroll screen showing 200 entries resolves a handful of documents instead
 * of parsing 400 embedded copies.
 */
const cache = new Map<string, FormSchema>();

export async function getSchema(schemaId: string): Promise<FormSchema | null> {
	if (!schemaId) return null;

	const cached = cache.get(schemaId);
	if (cached) return cached;

	try {
		const doc = await db.collection(C.formSchemas).doc(schemaId).get();
		if (!doc.exists()) return null;

		const schema = { ...(doc.data() as FormSchema), id: doc.id };
		cache.set(schemaId, schema);
		return schema;
	} catch (e) {
		console.error("Error getting form schema", e);
		return null;
	}
}

/** Resolves several ids at once, hitting the network only for cache misses. */
export async function getSchemas(
	schemaIds: string[],
): Promise<Record<string, FormSchema>> {
	const unique = [...new Set(schemaIds.filter(Boolean))];
	const result: Record<string, FormSchema> = {};

	await Promise.all(
		unique.map(async (id) => {
			const schema = await getSchema(id);
			if (schema) result[id] = schema;
		}),
	);

	return result;
}

/** The schema a company is currently collecting against. */
export async function getActiveSchema(
	companyId: string,
	kind: "eventForm" | "timeEntryForm",
): Promise<FormSchema | null> {
	try {
		const snapshot = await db
			.collection(C.formSchemas)
			.where("companyId", "==", companyId)
			.where("kind", "==", kind)
			.orderBy("version", "desc")
			.limit(1)
			.get();

		if (snapshot.empty) return null;
		const doc = snapshot.docs[0];
		const schema = { ...(doc.data() as FormSchema), id: doc.id };
		cache.set(schema.id, schema);
		return schema;
	} catch (e) {
		console.error("Error getting active schema", e);
		return null;
	}
}

/**
 * Publishes a NEW version. Never edits an existing schema.
 *
 * The caller repoints `companyPreferences.{kind}SchemaId` at the returned id;
 * entries submitted before that keep pointing at the previous version and go on
 * rendering exactly as they did when they were filled in.
 */
export async function publishSchema(
	companyId: string,
	kind: "eventForm" | "timeEntryForm",
	schema: {
		title: string;
		description: string;
		isEnabled: boolean;
		fields: FormField[];
	},
	createdBy: string,
): Promise<string> {
	const previous = await getActiveSchema(companyId, kind);
	const version = (previous?.version ?? 0) + 1;
	const id = `${companyId}_${kind}_v${version}`;

	await db.collection(C.formSchemas).doc(id).set({
		id,
		companyId,
		kind,
		version,
		title: schema.title,
		description: schema.description,
		isEnabled: schema.isEnabled,
		fields: schema.fields,
		contentHash: "",
		supersededBySchemaId: null,
		createdAt: firestore.FieldValue.serverTimestamp(),
		createdBy,
		schemaVersion: 2,
	});

	cache.delete(id);
	return id;
}

/** Only for tests and sign-out. Published schemas never change under a client. */
export function clearSchemaCache(): void {
	cache.clear();
}
