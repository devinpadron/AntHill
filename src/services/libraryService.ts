import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C } from "../constants/paths";
import { Checklist, EventLabel, Package } from "../types";

/*
 * Admin-authored company library: checklists, packages and event labels.
 *
 * These three are grouped because they are the same CRUD shape over the same
 * ownership rule (managers write, members read) and were previously scattered
 * across three admin SCREENS that each talked to Firestore directly —
 * ChecklistCreator, PackageCreator and LabelCreator.
 */

const LIBRARY_LIMIT = 200;

const mapDocs = <T>(snapshot: FirebaseFirestoreTypes.QuerySnapshot): T[] =>
	snapshot.docs.map((d) => ({ ...(d.data() as T), id: d.id }));

const stamps = () => ({
	updatedAt: firestore.FieldValue.serverTimestamp(),
});

/* ---------------------------------------------------------------- checklists */

export function subscribeChecklists(
	companyId: string,
	onChange: (checklists: Checklist[]) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.checklists)
		.where("companyId", "==", companyId)
		.orderBy("updatedAt", "desc")
		.limit(LIBRARY_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(mapDocs<Checklist>(snapshot)),
			(error) => console.error("Error subscribing to checklists", error),
		);
}

/**
 * Resolves several checklists in one query.
 *
 * Replaces the per-field fetch loops in CustomFormRender and FormFieldValue,
 * which issued one read per checklist-typed form field on every render.
 */
export async function getChecklistsByIds(
	companyId: string,
	ids: string[],
): Promise<Record<string, Checklist>> {
	const unique = [...new Set(ids.filter(Boolean))];
	if (!unique.length) return {};

	const result: Record<string, Checklist> = {};

	/*
	 * One document at a time, NOT `where(documentId(), "in", chunk)`.
	 *
	 * A keyed lookup is a list operation, and the read rule dereferences
	 * `resource.data.companyId` — so a single id that resolves to nothing fails
	 * the whole batch with permission-denied. These ids come off `event
	 * .checklistIds`, denormalized at write time, so an admin deleting a
	 * checklist leaves exactly that: an id pointing at nothing, which would
	 * take every other checklist on the event down with it.
	 */
	const found = await Promise.all(
		unique.map(async (id) => {
			try {
				const doc = await db.collection(C.checklists).doc(id).get();
				if (!doc.exists()) return null;
				const checklist = { ...(doc.data() as Checklist), id: doc.id };
				return checklist.companyId === companyId ? checklist : null;
			} catch (e) {
				console.error(`Error getting checklist ${id}`, e);
				return null;
			}
		}),
	);

	for (const checklist of found) {
		if (checklist) result[checklist.id] = checklist;
	}

	return result;
}

export async function saveChecklist(
	companyId: string,
	checklist: Partial<Checklist> & { id?: string },
): Promise<string> {
	const ref = checklist.id
		? db.collection(C.checklists).doc(checklist.id)
		: db.collection(C.checklists).doc();

	await ref.set(
		{
			...checklist,
			id: ref.id,
			companyId,
			...stamps(),
			...(checklist.id
				? {}
				: { createdAt: firestore.FieldValue.serverTimestamp() }),
			schemaVersion: 2,
		},
		{ merge: true },
	);

	return ref.id;
}

export async function deleteChecklist(checklistId: string): Promise<void> {
	await db.collection(C.checklists).doc(checklistId).delete();
}

/* ------------------------------------------------------------------ packages */

export function subscribePackages(
	companyId: string,
	onChange: (packages: Package[]) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.packages)
		.where("companyId", "==", companyId)
		.orderBy("title")
		.limit(LIBRARY_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(mapDocs<Package>(snapshot)),
			(error) => console.error("Error subscribing to packages", error),
		);
}

/**
 * The packages attached to an event, hydrated in ONE query.
 *
 * v1 had two different getEventPackages implementations with contradictory
 * assumptions about the element type, one of which looked for a `quantity`
 * field that was never written — so it always fell through to 1.
 */
export async function getPackagesByIds(
	companyId: string,
	ids: string[],
): Promise<Package[]> {
	const unique = [...new Set(ids.filter(Boolean))];
	if (!unique.length) return [];

	/*
	 * One document at a time, for the same reason as getChecklistsByIds: these
	 * ids live on `event.packageIds`, so a deleted package leaves a dangling id
	 * that a keyed `in` lookup turns into permission-denied for the whole set.
	 */
	const found = await Promise.all(
		unique.map(async (id) => {
			try {
				const doc = await db.collection(C.packages).doc(id).get();
				if (!doc.exists()) return null;
				const pkg = { ...(doc.data() as Package), id: doc.id };
				return pkg.companyId === companyId ? pkg : null;
			} catch (e) {
				console.error(`Error getting package ${id}`, e);
				return null;
			}
		}),
	);

	return found.filter((pkg): pkg is Package => pkg !== null);
}

export async function savePackage(
	companyId: string,
	pkg: Partial<Package> & { id?: string },
): Promise<string> {
	const ref = pkg.id
		? db.collection(C.packages).doc(pkg.id)
		: db.collection(C.packages).doc();

	await ref.set(
		{
			...pkg,
			id: ref.id,
			companyId,
			...stamps(),
			...(pkg.id
				? {}
				: { createdAt: firestore.FieldValue.serverTimestamp() }),
			schemaVersion: 2,
		},
		{ merge: true },
	);

	return ref.id;
}

export async function deletePackage(packageId: string): Promise<void> {
	await db.collection(C.packages).doc(packageId).delete();
}

/* --------------------------------------------------------------- event labels */

export function subscribeEventLabels(
	companyId: string,
	onChange: (labels: EventLabel[]) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.eventLabels)
		.where("companyId", "==", companyId)
		.orderBy("name")
		.limit(LIBRARY_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(mapDocs<EventLabel>(snapshot)),
			(error) =>
				console.error("Error subscribing to event labels", error),
		);
}

export async function saveEventLabel(
	companyId: string,
	label: Partial<EventLabel> & { id?: string },
): Promise<string> {
	const ref = label.id
		? db.collection(C.eventLabels).doc(label.id)
		: db.collection(C.eventLabels).doc();

	await ref.set(
		{
			...label,
			id: ref.id,
			companyId,
			...stamps(),
			...(label.id
				? {}
				: { createdAt: firestore.FieldValue.serverTimestamp() }),
			schemaVersion: 2,
		},
		{ merge: true },
	);

	return ref.id;
}

export async function deleteEventLabel(labelId: string): Promise<void> {
	await db.collection(C.eventLabels).doc(labelId).delete();
}
