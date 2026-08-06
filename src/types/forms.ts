import { CompanyScoped, Timestamp } from "./common";

/*
 * Company-customizable form schemas.
 *
 * In v1 these lived as `any` inside src/contexts/CompanyContext.tsx, and every
 * submitted time entry embedded TWO complete copies so historical entries could
 * still render. v2 keeps that guarantee without the duplication by making
 * schema documents immutable and versioned: editing a form PUBLISHES A NEW one
 * and repoints the preference. A reference to an immutable document is exactly
 * as durable as an embedded copy.
 */

export type FormFieldType =
	| "text"
	| "number"
	| "currency"
	| "quantity"
	| "date"
	// Offered by the admin editor and rendered everywhere, but omitted from
	// this union until now, so nothing type-checked a "time" field.
	| "time"
	| "checkbox"
	| "select"
	| "multiSelect"
	| "checklist"
	| "document"
	| "media";

export interface FormField {
	id: string;
	label: string;
	type: FormFieldType;
	required: boolean;

	/** number/quantity/currency */
	unit?: string;
	showTotal?: boolean;
	useMultiplier?: boolean;
	multiplier?: number;

	/**
	 * select / multiSelect.
	 *
	 * NOT `options`. The migration writes this name, but the admin editor wrote
	 * `options` and the renderer read `options`, so every migrated form lost its
	 * dropdown choices until someone happened to re-save it.
	 */
	selectOptions?: string[];

	/** Hint text shown in the empty input. Optional everywhere. */
	placeholder?: string;

	/**
	 * checklist — REQUIRED in v2.
	 *
	 * v1 allowed a legacy inline `options: string[]` here instead. The migration
	 * turns those into real `checklists/{id}` documents, which is what removes
	 * the dual-path normalization the renderers used to need.
	 */
	checklistId?: string;
	/** Denormalized so validation doesn't have to load the checklist. */
	checklistItemCount?: number;
	/** Denormalized for display, so the editor need not load the checklist. */
	checklistName?: string | null;
	checklistRequiredMode?: "atLeastOne" | "all";
}

/**
 * formSchemas/{schemaId} — IMMUTABLE once written.
 *
 * schemaId = `${companyId}_${kind}_v${version}`.
 */
export interface FormSchema extends CompanyScoped {
	id: string;
	kind: "eventForm" | "timeEntryForm";
	/** Monotonic per (companyId, kind). */
	version: number;
	title: string;
	description: string;
	isEnabled: boolean;
	fields: FormField[];
	/** sha256 of the normalized fields; `verify` asserts it still matches. */
	contentHash: string;
	supersededBySchemaId: string | null;
	createdAt: Timestamp;
	createdBy: string | null;
	schemaVersion: number;
}

/**
 * A submitted answer. Scalars for most field types; attachment-backed fields
 * (document/media) store references instead of inlining file objects the way
 * v1 did.
 */
export type FormResponseValue =
	string | number | boolean | null | { attachmentIds: string[] };

export type FormResponses = Record<string, FormResponseValue>;
