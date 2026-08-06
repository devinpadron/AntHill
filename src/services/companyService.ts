import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C } from "../constants/paths";
import { Company, CompanyPreferences } from "../types";

/*
 * The company document and its preferences.
 *
 * Preferences are a LIVE subscription here, not the one-shot read v1 used
 * (CompanyContext.tsx:93-140). HomeTabs feature-flags whole tabs off
 * `enableAvailability` / `enableTimeSheet`, so under v1 an admin toggling a
 * feature did not reach other devices until the app was relaunched.
 */

export const defaultPreferences: CompanyPreferences = {
	companyId: "",
	workWeekStarts: "sunday",
	allowUserEventEditing: false,
	canViewEventLabels: false,
	enableTimeSheet: false,
	enableAvailability: false,
	availabilityReminder: { enabled: false, hours: 0, minutes: 0 },
	eventFormSchemaId: null,
	timeEntryFormSchemaId: null,
	updatedAt: null as unknown as CompanyPreferences["updatedAt"],
	schemaVersion: 2,
};

export async function getCompany(companyId: string): Promise<Company | null> {
	try {
		const doc = await db.collection(C.companies).doc(companyId).get();
		return doc.exists() ? { ...(doc.data() as Company), id: doc.id } : null;
	} catch (e) {
		console.error("Error getting company", e);
		return null;
	}
}

/**
 * Several companies in one query.
 *
 * The switcher needs a NAME per membership, and a membership document only
 * carries the company id — so without this it would be one read per company
 * the user belongs to, every time the sheet opens.
 */
export async function getCompaniesByIds(ids: string[]): Promise<Company[]> {
	const unique = [...new Set(ids.filter(Boolean))].slice(0, 30);
	if (!unique.length) return [];

	try {
		const snapshot = await db
			.collection(C.companies)
			.where(firestore.FieldPath.documentId(), "in", unique)
			.limit(30)
			.get();

		return snapshot.docs.map((doc) => ({
			...(doc.data() as Company),
			id: doc.id,
		}));
	} catch (e) {
		console.error("Error getting companies by id", e);
		return [];
	}
}

export function subscribeCompany(
	companyId: string,
	onChange: (company: Company | null) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.companies)
		.doc(companyId)
		.onSnapshot(
			(doc) =>
				onChange(
					doc.exists()
						? { ...(doc.data() as Company), id: doc.id }
						: null,
				),
			(error) => console.error("Error subscribing to company", error),
		);
}

/**
 * Live preferences, merged over the defaults so a missing key can never break
 * the UI.
 */
export function subscribePreferences(
	companyId: string,
	onChange: (preferences: CompanyPreferences) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.companyPreferences)
		.doc(companyId)
		.onSnapshot(
			(doc) =>
				onChange({
					...defaultPreferences,
					companyId,
					...(doc.exists() ? (doc.data() as CompanyPreferences) : {}),
				}),
			(error) => console.error("Error subscribing to preferences", error),
		);
}

export async function getPreferences(
	companyId: string,
): Promise<CompanyPreferences> {
	try {
		const doc = await db
			.collection(C.companyPreferences)
			.doc(companyId)
			.get();
		return {
			...defaultPreferences,
			companyId,
			...(doc.exists() ? (doc.data() as CompanyPreferences) : {}),
		};
	} catch (e) {
		console.error("Error getting preferences", e);
		return { ...defaultPreferences, companyId };
	}
}

/**
 * Field-level patch.
 *
 * v1 spread the whole preferences object from local state into a merge write,
 * so an admin on a stale device could revive superseded values. Callers pass
 * only what changed.
 */
export async function updatePreferences(
	companyId: string,
	patch: Partial<CompanyPreferences>,
): Promise<void> {
	try {
		await db
			.collection(C.companyPreferences)
			.doc(companyId)
			.set(
				{
					...patch,
					companyId,
					updatedAt: firestore.FieldValue.serverTimestamp(),
					schemaVersion: 2,
				},
				{ merge: true },
			);
	} catch (e) {
		console.error("Error updating preferences", e);
		throw e;
	}
}

/** Looks up a company by access code. Used by signup and join-by-code. */
export async function findByAccessCode(
	accessCode: string,
): Promise<Company | null> {
	try {
		const snapshot = await db
			.collection(C.companies)
			.where("accessCode", "==", accessCode)
			.limit(1)
			.get();
		if (snapshot.empty) return null;

		const doc = snapshot.docs[0];
		return { ...(doc.data() as Company), id: doc.id };
	} catch (e) {
		console.error("Error finding company by access code", e);
		return null;
	}
}
