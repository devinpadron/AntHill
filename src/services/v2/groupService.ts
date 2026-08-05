import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../../lib/db";
import { C, membershipId } from "../../constants/paths";
import { Group, Membership } from "../../types/v2";

/*
 * Worker groups.
 *
 * A group is a named set of workers a manager can publish an event to. It
 * exists so a 1099 contractor can be shown only the jobs meant for them,
 * instead of every unassigned event the company has on the books.
 *
 * Group membership lives on the MEMBERSHIP document (`groupIds`), not in a
 * roster here. That keeps the member list one query and means "which groups is
 * this worker in" needs no join — which matters because publishing an event
 * has to resolve a group to its workers on every write.
 */

const GROUP_LIMIT = 100;
const MEMBER_LIMIT = 500;

const toGroup = (doc: FirebaseFirestoreTypes.DocumentSnapshot): Group => ({
	...(doc.data() as Group),
	id: doc.id,
});

export function subscribeGroups(
	companyId: string,
	onChange: (groups: Group[]) => void,
	onError?: (error: Error) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.groups)
		.where("companyId", "==", companyId)
		.orderBy("name")
		.limit(GROUP_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(snapshot.docs.map(toGroup)),
			(error) => {
				console.error("Error subscribing to groups", error);
				onError?.(error);
			},
		);
}

export async function getGroups(companyId: string): Promise<Group[]> {
	try {
		const snapshot = await db
			.collection(C.groups)
			.where("companyId", "==", companyId)
			.orderBy("name")
			.limit(GROUP_LIMIT)
			.get();
		return snapshot.docs.map(toGroup);
	} catch (e) {
		console.error("Error getting groups", e);
		return [];
	}
}

export async function createGroup(
	companyId: string,
	name: string,
): Promise<string> {
	const ref = db.collection(C.groups).doc();
	const now = firestore.FieldValue.serverTimestamp();

	try {
		await ref.set({
			id: ref.id,
			companyId,
			name: name.trim(),
			createdAt: now,
			updatedAt: now,
			schemaVersion: 2,
		});
		return ref.id;
	} catch (e) {
		console.error("Error creating group", e);
		throw e;
	}
}

export async function renameGroup(
	groupId: string,
	name: string,
): Promise<void> {
	try {
		await db.collection(C.groups).doc(groupId).update({
			name: name.trim(),
			updatedAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (e) {
		console.error("Error renaming group", e);
		throw e;
	}
}

/**
 * Deletes a group and removes it from every membership that referenced it.
 *
 * The cleanup is the point. A dangling groupId on a membership is invisible —
 * the worker stays in a group that no longer appears in any picker, so nobody
 * can see why they are or are not receiving jobs.
 *
 * Events keep their `audienceGroupIds` history, but invitations already sent
 * are not retracted: a worker who was asked about a job stays asked.
 */
export async function deleteGroup(
	companyId: string,
	groupId: string,
): Promise<void> {
	try {
		const members = await db
			.collection(C.memberships)
			.where("companyId", "==", companyId)
			.where("groupIds", "array-contains", groupId)
			.limit(MEMBER_LIMIT)
			.get();

		const batch = db.batch();
		const now = firestore.FieldValue.serverTimestamp();

		for (const doc of members.docs) {
			batch.update(doc.ref, {
				groupIds: firestore.FieldValue.arrayRemove(groupId),
				updatedAt: now,
			});
		}
		batch.delete(db.collection(C.groups).doc(groupId));

		await batch.commit();
	} catch (e) {
		console.error("Error deleting group", e);
		throw e;
	}
}

/**
 * Every active member of the given groups, deduplicated.
 *
 * Firestore caps `array-contains-any` at 30 values, which is far more groups
 * than a catering company will have, but chunking costs nothing and turns a
 * silent truncation into a correct answer.
 */
export async function getMembersInGroups(
	companyId: string,
	groupIds: string[],
): Promise<Membership[]> {
	if (!groupIds.length) return [];

	const chunks: string[][] = [];
	for (let i = 0; i < groupIds.length; i += 30) {
		chunks.push(groupIds.slice(i, i + 30));
	}

	try {
		const snapshots = await Promise.all(
			chunks.map((chunk) =>
				db
					.collection(C.memberships)
					.where("companyId", "==", companyId)
					.where("status", "==", "active")
					.where("groupIds", "array-contains-any", chunk)
					.limit(MEMBER_LIMIT)
					.get(),
			),
		);

		const byId = new Map<string, Membership>();
		for (const snapshot of snapshots) {
			for (const doc of snapshot.docs) {
				byId.set(doc.id, {
					...(doc.data() as Membership),
					id: doc.id,
				});
			}
		}
		return [...byId.values()];
	} catch (e) {
		console.error("Error getting members in groups", e);
		return [];
	}
}

/** Sets which groups a worker belongs to. Manager action. */
export async function setMemberGroups(
	companyId: string,
	userId: string,
	groupIds: string[],
): Promise<void> {
	try {
		await db
			.collection(C.memberships)
			.doc(membershipId(companyId, userId))
			.update({
				groupIds: [...new Set(groupIds)],
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
	} catch (e) {
		console.error("Error setting member groups", e);
		throw e;
	}
}

/**
 * Switches a worker between seeing every open job and seeing only what they
 * are invited to. Manager action — the security rules forbid a worker from
 * changing their own.
 */
export async function setMemberVisibility(
	companyId: string,
	userId: string,
	visibility: "open" | "restricted",
): Promise<void> {
	try {
		await db
			.collection(C.memberships)
			.doc(membershipId(companyId, userId))
			.update({
				visibility,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
	} catch (e) {
		console.error("Error setting member visibility", e);
		throw e;
	}
}
