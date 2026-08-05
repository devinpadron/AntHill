import { useEffect, useState } from "react";
import { getSchema, getSchemas } from "../services/formSchemaService";
import { getChecklistsByIds } from "../services/libraryService";
import { Checklist, FormSchema } from "../types";

/*
 * Resolves a form schema by id, plus any checklists its fields reference.
 *
 * Schemas are immutable, so the service caches them forever and a screen
 * rendering many entries resolves each distinct schema once. v1 embedded a full
 * copy in every entry and re-parsed it per render, and fetched one checklist
 * per checklist-typed field on top.
 */

export function useFormSchema(
	schemaId: string | null | undefined,
	companyId: string,
) {
	const [schema, setSchema] = useState<FormSchema | null>(null);
	const [checklists, setChecklists] = useState<Record<string, Checklist>>({});
	const [isLoading, setIsLoading] = useState(Boolean(schemaId));

	useEffect(() => {
		if (!schemaId) {
			setSchema(null);
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		setIsLoading(true);

		(async () => {
			const next = await getSchema(schemaId);
			if (cancelled) return;
			setSchema(next);

			// One batched query for every checklist the schema references.
			const ids = (next?.fields ?? [])
				.map((f) => f.checklistId)
				.filter(Boolean) as string[];

			if (ids.length) {
				const resolved = await getChecklistsByIds(companyId, ids);
				if (!cancelled) setChecklists(resolved);
			} else if (!cancelled) {
				setChecklists({});
			}

			if (!cancelled) setIsLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [schemaId, companyId]);

	return { schema, checklists, isLoading };
}

/** Resolves several schemas at once, for list screens. */
export function useFormSchemas(schemaIds: (string | null | undefined)[]) {
	const [schemas, setSchemas] = useState<Record<string, FormSchema>>({});
	const key = schemaIds.filter(Boolean).sort().join(",");

	useEffect(() => {
		if (!key) {
			setSchemas({});
			return;
		}
		let cancelled = false;
		getSchemas(key.split(",")).then((next) => {
			if (!cancelled) setSchemas(next);
		});
		return () => {
			cancelled = true;
		};
	}, [key]);

	return schemas;
}
