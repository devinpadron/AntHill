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
	/*
	 * TRUE, unlike its neighbours, because it is not a new capability — it is
	 * what the app already did for every company. Defaulting it off would
	 * silently switch off the confirm banner and the Calendar badge everywhere
	 * the moment this shipped.
	 */
	requireAssignmentAcknowledgement: true,
	acknowledgementReminder: { enabled: false, hours: 0, minutes: 0 },
	/*
	 * Both location blocks default OFF, and the sampling numbers matter as much
	 * as the flag.
	 *
	 * 50 m / 60 s is a shift route, not a movement study: it draws the trip from
	 * the commissary to the venue legibly while letting the OS coalesce fixes and
	 * keep the radio asleep between them. Tightening either is the fastest way to
	 * turn this feature into the reason nobody's phone survives a double.
	 *
	 * 150 m is the geofence radius, and it is a floor as much as a default —
	 * consumer GPS wanders far enough that a tighter fence reports the worker
	 * arriving and leaving while the phone sits on a shelf.
	 */
	locationTracking: {
		enabled: false,
		minDistanceMeters: 50,
		minIntervalSeconds: 60,
		/*
		 * The three transparency settings default ON, and it matters that they
		 * are `true` here rather than merely documented as recommended: a
		 * company that switches tracking on and never scrolls to the rest of
		 * this card gets the open behaviour by default, not the quiet one.
		 */
		showRecordingIndicator: true,
		workersSeeOwnRoutes: true,
		allowDeclining: true,
	},
	clockReminderGeofence: {
		enabled: false,
		label: null,
		address: null,
		latitude: null,
		longitude: null,
		radiusMeters: 150,
		/* What a shop-based company expects; the staging-site case opts in. */
		clockOutTrigger: "leaving",
	},
	eventFormSchemaId: null,
	timeEntryFormSchemaId: null,
	updatedAt: null as unknown as CompanyPreferences["updatedAt"],
	schemaVersion: 2,
};

/**
 * Defaults under a stored document.
 *
 * The spread is SHALLOW, which is correct for the flat flags and wrong for the
 * nested blocks: a document holding `{ locationTracking: { enabled: true } }`
 * would shallow-merge to a settings object with no sampling numbers at all, and
 * the tracker would ask the OS for `undefined` metres. The nested blocks are
 * therefore merged a level deeper, by name. Add a nested block to
 * CompanyPreferences and it belongs in this list.
 */
function withDefaults(
	companyId: string,
	stored: Partial<CompanyPreferences>,
): CompanyPreferences {
	return {
		...defaultPreferences,
		...stored,
		companyId,
		availabilityReminder: {
			...defaultPreferences.availabilityReminder,
			...stored.availabilityReminder,
		},
		acknowledgementReminder: {
			...defaultPreferences.acknowledgementReminder,
			...stored.acknowledgementReminder,
		},
		locationTracking: {
			...defaultPreferences.locationTracking,
			...stored.locationTracking,
		},
		clockReminderGeofence: {
			...defaultPreferences.clockReminderGeofence,
			...stored.clockReminderGeofence,
		},
	};
}

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
				onChange(
					withDefaults(
						companyId,
						doc.exists() ? (doc.data() as CompanyPreferences) : {},
					),
				),
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
		return withDefaults(
			companyId,
			doc.exists() ? (doc.data() as CompanyPreferences) : {},
		);
	} catch (e) {
		console.error("Error getting preferences", e);
		return withDefaults(companyId, {});
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
