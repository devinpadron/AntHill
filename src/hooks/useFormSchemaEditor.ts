import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "../contexts/UserContext";
import { useCompany } from "../contexts/CompanyContext";
import { getSchema, publishSchema } from "../services/formSchemaService";
import { subscribeChecklists } from "../services/libraryService";
import { FormField, FormFieldType } from "../types";

/** The editable draft. A published `FormSchema` also carries id/version/author. */
export type FormDraft = {
	title: string;
	description: string;
	isEnabled: boolean;
	fields: FormField[];
};

export type ChecklistOption = { id: string; name: string };

const EMPTY_DRAFT: FormDraft = {
	title: "",
	description: "",
	isEnabled: false,
	fields: [],
};

/**
 * Edits one of a company's two custom form schemas.
 *
 * Schema documents are IMMUTABLE. Saving publishes a new version and repoints
 * the company preference at it, which is what lets a time entry submitted a
 * year ago still render against the schema it was actually submitted under.
 * So this hook edits a local draft and publishes; it never mutates in place.
 *
 * `isDirty` compares the draft with what was last loaded or published. The
 * screen used to have no way to tell, so its Save button looked the same
 * before and after an edit and leaving simply dropped the draft.
 */
export const useFormSchemaEditor = (isEventForm: boolean) => {
	const { companyId, userId } = useUser();
	const { preferences, updatePreferences, isLoading } = useCompany();

	const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
	/** The draft as last loaded or published — what "unchanged" means. */
	const [baseline, setBaseline] = useState<FormDraft>(EMPTY_DRAFT);
	const [loadedSchemaId, setLoadedSchemaId] = useState<string | null>(null);
	const savingRef = useRef(false);
	const publishedIdRef = useRef<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [checklists, setChecklists] = useState<ChecklistOption[]>([]);

	const schemaId = isEventForm
		? preferences.eventFormSchemaId
		: preferences.timeEntryFormSchemaId;

	// The preference holds a REFERENCE, so the schema is a second read.
	useEffect(() => {
		if (!schemaId) return;
		// Our own publish repoints the preference at a schema whose content is
		// already the draft. Reloading it would overwrite anything typed in the
		// moment between the save landing and the read coming back.
		if (schemaId === publishedIdRef.current) {
			setLoadedSchemaId(schemaId);
			return;
		}
		let cancelled = false;

		getSchema(schemaId)
			.then((schema) => {
				if (cancelled || !schema) return;
				const loaded: FormDraft = {
					title: schema.title,
					description: schema.description,
					isEnabled: schema.isEnabled,
					fields: schema.fields,
				};
				setDraft(loaded);
				setBaseline(loaded);
			})
			.finally(() => {
				if (!cancelled) setLoadedSchemaId(schemaId);
			});

		return () => {
			cancelled = true;
		};
	}, [schemaId]);

	// Checklists a checklist-typed field can point at. One live subscription.
	useEffect(() => {
		if (!companyId) return;
		return subscribeChecklists(companyId, (next) =>
			setChecklists(
				next.map((checklist) => ({
					id: checklist.id,
					name: checklist.title || checklist.id,
				})),
			),
		);
	}, [companyId]);

	/** Publishes the draft. Resolves whether it was saved; the caller reports it. */
	const save = useCallback(async (): Promise<boolean> => {
		if (!companyId || savingRef.current) return false;

		try {
			savingRef.current = true;
			setIsSaving(true);
			const kind = isEventForm ? "eventForm" : "timeEntryForm";
			const newSchemaId = await publishSchema(
				companyId,
				kind,
				draft,
				userId,
			);

			publishedIdRef.current = newSchemaId;
			await updatePreferences(
				isEventForm
					? { eventFormSchemaId: newSchemaId }
					: { timeEntryFormSchemaId: newSchemaId },
			);

			setBaseline(draft);
			return true;
		} catch (error) {
			console.error("Failed to save form:", error);
			return false;
		} finally {
			savingRef.current = false;
			setIsSaving(false);
		}
	}, [companyId, userId, isEventForm, draft, updatePreferences]);

	/* ------------------------------------------------------------- fields */

	const addField = useCallback((): FormField => {
		const field: FormField = {
			id: Date.now().toString(),
			type: "text",
			label: "New Field",
			placeholder: "",
			required: false,
		};
		setDraft((prev) => ({ ...prev, fields: [...prev.fields, field] }));
		return field;
	}, []);

	const updateField = useCallback(
		(fieldId: string, updates: Partial<FormField>) => {
			setDraft((prev) => ({
				...prev,
				fields: prev.fields.map((field) =>
					field.id === fieldId ? { ...field, ...updates } : field,
				),
			}));
		},
		[],
	);

	const removeField = useCallback((fieldId: string) => {
		setDraft((prev) => ({
			...prev,
			fields: prev.fields.filter((field) => field.id !== fieldId),
		}));
	}, []);

	const reorderFields = useCallback((fields: FormField[]) => {
		setDraft((prev) => ({ ...prev, fields }));
	}, []);

	const toggleEnabled = useCallback(() => {
		setDraft((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
	}, []);

	const setMeta = useCallback((updates: Partial<FormDraft>) => {
		setDraft((prev) => ({ ...prev, ...updates }));
	}, []);

	/**
	 * Resolves what an edited field should become, given the type-specific
	 * inputs the editor keeps outside the field itself.
	 *
	 * Returned rather than applied so the caller stays in charge of when the
	 * edit lands. `selectOptions` is the name the schema and the migration both
	 * use — writing `options` here is what left migrated forms with no choices.
	 */
	const resolveFieldEdit = useCallback(
		(
			field: FormField,
			type: FormFieldType,
			optionsText: string,
			checklistId: string | null,
		): FormField => {
			const next: FormField = { ...field, type };

			if (type === "select" || type === "multiSelect") {
				next.selectOptions = optionsText
					.split(",")
					.map((option) => option.trim())
					.filter(Boolean);
			}

			if (type === "checklist") {
				next.checklistRequiredMode =
					field.checklistRequiredMode || "atLeastOne";
				next.checklistId = checklistId || null;
				next.checklistName =
					checklists.find(
						(c) => c.id === (checklistId ?? field.checklistId),
					)?.name ??
					field.checklistName ??
					null;
				// A checklist field carries no dropdown options.
				delete next.selectOptions;
			}

			return next;
		},
		[checklists],
	);

	const isDirty = useMemo(
		() => JSON.stringify(draft) !== JSON.stringify(baseline),
		[draft, baseline],
	);

	return {
		draft,
		setMeta,
		// The schema is a second read behind the preference. Until it lands the
		// draft is the empty placeholder, and edits made to that would be
		// overwritten when the real one arrived.
		isLoading: isLoading || (!!schemaId && loadedSchemaId !== schemaId),
		isSaving,
		isDirty,
		save,

		checklists,

		addField,
		updateField,
		removeField,
		reorderFields,
		toggleEnabled,
		resolveFieldEdit,
	};
};
