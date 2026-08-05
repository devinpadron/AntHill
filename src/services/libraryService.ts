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

	// `in` accepts at most 30 values per query.
	for (let i = 0; i < unique.length; i += 30) {
		const chunk = unique.slice(i, i + 30);
		try {
			const snapshot = await db
				.collection(C.checklists)
				.where("companyId", "==", companyId)
				.where(firestore.FieldPath.documentId(), "in", chunk)
				.limit(30)
				.get();
			for (const checklist of mapDocs<Checklist>(snapshot)) {
				result[checklist.id] = checklist;
			}
		} catch (e) {
			console.error("Error getting checklists by id", e);
		}
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
	const unique = [...new Set(ids.filter(Boolean))].slice(0, 30);
	if (!unique.length) return [];

	try {
		const snapshot = await db
			.collection(C.packages)
			.where("companyId", "==", companyId)
			.where(firestore.FieldPath.documentId(), "in", unique)
			.limit(30)
			.get();
		return mapDocs<Package>(snapshot);
	} catch (e) {
		console.error("Error getting packages by id", e);
		return [];
	}
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
