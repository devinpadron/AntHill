import { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C, membershipId } from "../constants/paths";
import {
	Membership,
	NotificationPreferences,
	withLegacyTeamMirror,
	WorkerVisibility,
} from "../types";
import { Role } from "../types";
import { lookupJoinCode } from "./groupService";

/*
 * Company membership.
 *
 * Replaces the membership halves of companyService and userService. In v1 this
 * lived in two places kept in sync by two non-atomic writes:
 *
 *     Users/{uid}.companies[]   <->   Companies/{cid}/Users/{uid}
 *
 * which could orphan either way, and did — the audit found five such records.
 * v2 has one document per (company, user), and the user's profile fields are
 * denormalized onto it so a member list is ONE query instead of the N+1
 * fan-outs at companyService.ts:56-63, userService.ts:167-171 and :199-208,
 * useEmployeeData.ts:43-46, EventSubmit.tsx:158-167 and PayrollReview.tsx:88-89.
 */

const MEMBER_LIMIT = 500;

const toMembership = (
	doc: FirebaseFirestoreTypes.DocumentSnapshot,
): Membership => ({ ...(doc.data() as Membership), id: doc.id });

/**
 * Live member list for a company — one query, fully populated.
 * Returns the unsubscribe function synchronously.
 */
export function subscribeMembers(
	companyId: string,
	onChange: (members: Membership[]) => void,
	onError?: (error: Error) => void,
): () => void {
	if (!companyId) return () => {};

	return db
		.collection(C.memberships)
		.where("companyId", "==", companyId)
		.where("status", "==", "active")
		.orderBy("lastName")
		.limit(MEMBER_LIMIT)
		.onSnapshot(
			(snapshot) => onChange(snapshot.docs.map(toMembership)),
			(error) => {
				console.error("Error subscribing to members", error);
				onError?.(error);
			},
		);
}

export async function getMembers(companyId: string): Promise<Membership[]> {
	try {
		const snapshot = await db
			.collection(C.memberships)
			.where("companyId", "==", companyId)
			.where("status", "==", "active")
			.orderBy("lastName")
			.limit(MEMBER_LIMIT)
			.get();
		return snapshot.docs.map(toMembership);
	} catch (e) {
		console.error("Error getting members", e);
		return [];
	}
}

export async function getMembership(
	companyId: string,
	userId: string,
): Promise<Membership | null> {
	try {
		const doc = await db
			.collection(C.memberships)
			.doc(membershipId(companyId, userId))
			.get();
		return doc.exists() ? toMembership(doc) : null;
	} catch (e) {
		console.error("Error getting membership", e);
		return null;
	}
}

/** The signed-in user's role in a company. Drives isAdmin. */
export function subscribeMembership(
	companyId: string,
	userId: string,
	onChange: (membership: Membership | null) => void,
): () => void {
	// RNFirebase throws on an empty document path, which is what an unguarded
	// first render produces.
	if (!companyId || !userId) return () => {};

	return db
		.collection(C.memberships)
		.doc(membershipId(companyId, userId))
		.onSnapshot(
			(doc) => onChange(doc.exists() ? toMembership(doc) : null),
			(error) => console.error("Error subscribing to membership", error),
		);
}

/** Every company a user belongs to. Replaces v1's `Users.companies[]`. */
export async function getMembershipsForUser(
	userId: string,
): Promise<Membership[]> {
	try {
		const snapshot = await db
			.collection(C.memberships)
			.where("userId", "==", userId)
			.where("status", "==", "active")
			.get();
		return snapshot.docs.map(toMembership);
	} catch (e) {
		console.error("Error getting memberships for user", e);
		return [];
	}
}

/**
 * Joins a company by code.
 *
 * ONE field accepts two kinds of code. A company access code puts you in the
 * company with no group, exactly as before. A GROUP join code puts you in the
 * company AND straight into that group, with the visibility the manager chose
 * for it — which is how a 1099 contractor ends up restricted from their first
 * launch without anyone having to remember to set it afterwards.
 *
 * The company code is tried first, so an existing code can never be shadowed
 * by a group code that happens to collide.
 *
 * A transaction, so the membership and the user's active company move
 * together. v1 did these as two separate writes, which is the orphan window
 * the audit found.
 */
export type ResolvedJoinCode = {
	companyId: string;
	/** Present only for a group code. */
	group?: { groupId: string; code: string; visibility: WorkerVisibility };
};

/**
 * Works out what a typed code means, WITHOUT writing anything.
 *
 * Split out so signup can check a code before it creates any documents. A
 * users/{uid} document cannot be deleted by its owner (firestore.rules —
 * `allow delete: if false`), so a signup that created the profile first and
 * then discovered a bad code would have no way to clean up after itself.
 *
 * The company access code is tried first, so an existing code can never be
 * shadowed by a group code that happens to collide.
 */
export async function resolveJoinCode(
	code: string,
): Promise<ResolvedJoinCode | null> {
	const trimmed = code.trim();
	if (!trimmed) return null;

	const matches = await db
		.collection(C.companies)
		.where("accessCode", "==", trimmed)
		.limit(1)
		.get();

	if (!matches.empty) return { companyId: matches.docs[0].id };

	/*
	 * Falls through to a group code only when the company lookup misses. The
	 * group code is read by document id — the id IS the code — so a wrong code
	 * is a miss, not an enumeration.
	 */
	const groupCode = await lookupJoinCode(trimmed);
	if (!groupCode) return null;

	return {
		companyId: groupCode.companyId,
		group: {
			groupId: groupCode.groupId,
			code: groupCode.code,
			visibility: groupCode.visibility,
		},
	};
}

export async function joinCompanyWithAccessCode(
	userId: string,
	accessCode: string,
	resolved?: ResolvedJoinCode | null,
): Promise<{ companyId: string; groupId?: string } | null> {
	try {
		// Signup resolves the code up front to decide whether to create an
		// account at all, and passes the result through rather than paying for
		// the lookup twice.
		const match = resolved ?? (await resolveJoinCode(accessCode));
		if (!match) return null;

		const { companyId, group: groupCode } = match;
		const id = membershipId(companyId, userId);

		return await db.runTransaction(async (tx) => {
			const membershipRef = db.collection(C.memberships).doc(id);
			const userRef = db.collection(C.users).doc(userId);

			const [existing, user] = await Promise.all([
				tx.get(membershipRef),
				tx.get(userRef),
			]);

			if (existing.exists() && existing.data()?.status === "active") {
				return null; // already a member
			}

			const profile = user.data() ?? {};
			const now = firestore.FieldValue.serverTimestamp();

			tx.set(membershipRef, {
				id,
				companyId,
				userId,
				role: Role.USER,
				firstName: profile.firstName ?? "",
				lastName: profile.lastName ?? "",
				email: profile.email ?? "",
				phone: profile.phone ?? null,
				status: "active",
				/*
				 * Written explicitly, not left to a default. A membership
				 * without these fields is skipped by every equality and
				 * array-contains filter that uses them, so a new joiner would
				 * be invisible to group resolution.
				 *
				 * `joinedViaCode` is not decoration — the security rules read
				 * it back to confirm that a join claiming a group really
				 * presented that group's code. Dropping it here would make
				 * every group join fail.
				 */
				visibility: groupCode ? groupCode.visibility : "open",
				groupIds: groupCode ? [groupCode.groupId] : [],
				...(groupCode ? { joinedViaCode: groupCode.code } : {}),
				joinedAt: now,
				createdAt: now,
				updatedAt: now,
				schemaVersion: 2,
			});
			tx.update(userRef, {
				loggedInCompanyId: companyId,
				updatedAt: now,
			});

			return groupCode
				? { companyId, groupId: groupCode.groupId }
				: { companyId };
		});
	} catch (e) {
		console.error("Error joining company", e);
		throw e;
	}
}

/**
 * Removes a member.
 *
 * Marks the membership `removed` rather than deleting it, so historical event
 * responses and time entries still resolve to a name. v1 deleted the record,
 * which is why 48 event assignments now point at users that cannot be
 * resolved.
 *
 * If this was the user's active company, their active company is cleared —
 * never their profile. v1 deleted the user document when they left their last
 * company, which left the Auth account behind and crashed the app on next
 * launch (useAuth.ts reads `userData.email` off the resulting null).
 */
export async function removeMember(
	companyId: string,
	userId: string,
): Promise<void> {
	const id = membershipId(companyId, userId);

	try {
		await db.runTransaction(async (tx) => {
			const membershipRef = db.collection(C.memberships).doc(id);
			const userRef = db.collection(C.users).doc(userId);
			const user = await tx.get(userRef);
			const now = firestore.FieldValue.serverTimestamp();

			tx.update(membershipRef, { status: "removed", updatedAt: now });

			if (user.data()?.loggedInCompanyId === companyId) {
				tx.update(userRef, { loggedInCompanyId: null, updatedAt: now });
			}
		});
	} catch (e) {
		console.error("Error removing member", e);
		throw e;
	}
}

export async function changeMemberRole(
	companyId: string,
	userId: string,
	role: Role,
): Promise<void> {
	try {
		await db
			.collection(C.memberships)
			.doc(membershipId(companyId, userId))
			.update({
				role,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
	} catch (e) {
		console.error("Error changing member role", e);
		throw e;
	}
}

/**
 * Which pushes this member gets.
 *
 * Written by the member themselves from personal settings. The security rules
 * allow `notifications` in a self-update alongside the profile fields — role,
 * status, visibility and groups are still manager-only, so this cannot be used
 * to widen anyone's access.
 *
 * The legacy `team` mirror is recomputed HERE rather than at the call site, so
 * a second screen that writes preferences cannot forget it and leave a stale
 * value for readers that have not shipped the split yet.
 */
export async function setNotificationPreferences(
	companyId: string,
	userId: string,
	preferences: NotificationPreferences,
): Promise<void> {
	try {
		await db
			.collection(C.memberships)
			.doc(membershipId(companyId, userId))
			.update({
				notifications: withLegacyTeamMirror(preferences),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			});
	} catch (e) {
		console.error("Error saving notification preferences", e);
		throw e;
	}
}

/**
 * Propagates a profile edit onto the denormalized copies.
 * Bounded by the number of companies a user belongs to.
 */
export async function syncProfileToMemberships(
	userId: string,
	profile: {
		firstName?: string;
		lastName?: string;
		email?: string;
		phone?: string | null;
	},
): Promise<void> {
	try {
		const memberships = await getMembershipsForUser(userId);
		if (!memberships.length) return;

		const batch = db.batch();
		const now = firestore.FieldValue.serverTimestamp();

		for (const membership of memberships) {
			batch.update(db.collection(C.memberships).doc(membership.id), {
				...profile,
				updatedAt: now,
			});
		}

		await batch.commit();
	} catch (e) {
		console.error("Error syncing profile to memberships", e);
	}
}
