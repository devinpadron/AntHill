import { useEffect, useState } from "react";
import { getSchema } from "../services/formSchemaService";
import { FormField, FormSchema } from "../types";

/**
 * The empty value a field starts at.
 *
 * One definition. The submit modal had this switch written out twice — once
 * for the time-entry form and once per connected event — so a new field type
 * only ever got handled in whichever copy someone happened to edit.
 */
export const blankResponseFor = (field: FormField) => {
	if (field.type === "checkbox") return false;
	if (field.type === "multiSelect" || field.type === "checklist") return [];
	return "";
};

/**
 * A full set of empty responses for one schema.
 *
 * Draft values, so deliberately not typed as the persisted `FormResponses` —
 * see the note in CustomFormRender.
 */
export const blankResponsesFor = (
	schema: { fields: FormField[] } | null,
): Record<string, any> =>
	Object.fromEntries(
		(schema?.fields ?? []).map((field) => [
			field.id,
			blankResponseFor(field),
		]),
	);

/**
 * Resolves the company's two form schemas by reference.
 *
 * Preferences used to carry the schema objects inline; they now hold ids
 * pointing at immutable versioned documents, so an entry submitted today keeps
 * rendering against today's schema no matter how the form is edited later.
 *
 * Only ENABLED schemas are returned — a disabled form should render nothing
 * rather than an empty section.
 */
export const useSubmitFormSchemas = (
	companyId: string | null,
	eventFormSchemaId: string | null,
	timeEntryFormSchemaId: string | null,
) => {
	const [eventSchema, setEventSchema] = useState<FormSchema | null>(null);
	const [entrySchema, setEntrySchema] = useState<FormSchema | null>(null);
	const [isSchemaLoading, setIsSchemaLoading] = useState(true);

	useEffect(() => {
		if (!companyId) return;
		let cancelled = false;
		setIsSchemaLoading(true);

		(async () => {
			const [event, entry] = await Promise.all([
				getSchema(eventFormSchemaId),
				getSchema(timeEntryFormSchemaId),
			]);
			if (cancelled) return;

			setEventSchema(event?.isEnabled ? event : null);
			setEntrySchema(entry?.isEnabled ? entry : null);
			setIsSchemaLoading(false);
		})();

		return () => {
			cancelled = true;
		};
	}, [companyId, eventFormSchemaId, timeEntryFormSchemaId]);

	return { eventSchema, entrySchema, isSchemaLoading };
};
