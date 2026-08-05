import firestore from "@react-native-firebase/firestore";
import db from "../../lib/db";
import { C, APP_DATA, APP_CONFIG } from "../../constants/paths";
import { FALLBACK_ACTIVE_SCHEMA_VERSION } from "../../constants/schema";
import { User, UserSettings } from "../../types/v2";
import { syncProfileToMemberships } from "./membershipService";

/*
 * User profiles.
 *
 * Membership has moved out entirely — `companies[]` does not exist in v2. That
 * removes the bidirectional-sync orphan class by construction.
 */

export async function getUser(userId: string): Promise<User | null> {
	try {
		const doc = await db.collection(C.users).doc(userId).get();
		return doc.exists() ? { ...(doc.data() as User), id: doc.id } : null;
	} catch (e) {
		console.error("Error getting user", e);
		return null;
	}
}

export function subscribeUser(
	userId: string,
	onChange: (user: User | null) => void,
): () => void {
	if (!userId) return () => {};

	return db
		.collection(C.users)
		.doc(userId)
		.onSnapshot(
			(doc) =>
				onChange(
					doc.exists()
						? { ...(doc.data() as User), id: doc.id }
						: null,
				),
			(error) => console.error("Error subscribing to user", error),
		);
}

export async function createUser(
	userId: string,
	profile: { firstName: string; lastName: string; email: string },
): Promise<void> {
	const now = firestore.FieldValue.serverTimestamp();

	await db.collection(C.users).doc(userId).set({
		id: userId,
		firstName: profile.firstName,
		lastName: profile.lastName,
		email: profile.email,
		emailLower: profile.email.toLowerCase(),
		phone: null,
		loggedInCompanyId: null,
		fcmTokens: [],
		lastSeenAppVersion: null,
		lastSeenAt: null,
		createdAt: now,
		updatedAt: now,
		schemaVersion: 2,
	});
}

/**
 * Updates the profile and propagates it to the denormalized copies on the
 * user's memberships, which is what keeps member lists a single query.
 *
 * Replaces useProfile.updatePhone, which wrote the same field THREE times —
 * directly to Users, to the dead Companies/{c}/Employees document, and again
 * via updateUser.
 */
export async function updateProfile(
	userId: string,
	patch: {
		firstName?: string;
		lastName?: string;
		email?: string;
		phone?: string | null;
	},
): Promise<void> {
	const update: Record<string, unknown> = {
		...patch,
		updatedAt: firestore.FieldValue.serverTimestamp(),
	};
	if (patch.email) update.emailLower = patch.email.toLowerCase();

	await db.collection(C.users).doc(userId).update(update);
	await syncProfileToMemberships(userId, patch);
}

/** Switches the active company. Membership is verified by the security rules. */
export async function setActiveCompany(
	userId: string,
	companyId: string | null,
): Promise<void> {
	await db.collection(C.users).doc(userId).update({
		loggedInCompanyId: companyId,
		updatedAt: firestore.FieldValue.serverTimestamp(),
	});
}

export async function recordAppLaunch(
	userId: string,
	appVersion: string,
): Promise<void> {
	if (!userId) return;
	try {
		await db.collection(C.users).doc(userId).update({
			lastSeenAppVersion: appVersion,
			lastSeenAt: firestore.FieldValue.serverTimestamp(),
		});
	} catch (e) {
		console.error("Error recording app launch", e);
	}
}

/* ------------------------------------------------------------ push tokens */

/**
 * Single object argument on purpose.
 *
 * v1's `clearNotificationToken(token, userId)` was called as
 * `(userId, token)` at UserContext.tsx:258, so logout never removed the token
 * and instead wrote to a document named after the token. Named fields make that
 * mistake unrepresentable.
 */
export async function addPushToken({
	userId,
	token,
}: {
	userId: string;
	token: string;
}): Promise<void> {
	if (!userId || !token) return;
	try {
		await db
			.collection(C.users)
			.doc(userId)
			.update({ fcmTokens: firestore.FieldValue.arrayUnion(token) });
	} catch (e) {
		console.error("Error adding push token", e);
	}
}

export async function removePushToken({
	userId,
	token,
}: {
	userId: string;
	token: string;
}): Promise<void> {
	if (!userId || !token) return;
	try {
		await db
			.collection(C.users)
			.doc(userId)
			.update({ fcmTokens: firestore.FieldValue.arrayRemove(token) });
	} catch (e) {
		console.error("Error removing push token", e);
	}
}

/* --------------------------------------------------------------- settings */

export function subscribeUserSettings(
	userId: string,
	onChange: (settings: UserSettings | null) => void,
): () => void {
	if (!userId) return () => {};

	return db
		.collection(C.userSettings)
		.doc(userId)
		.onSnapshot(
			(doc) =>
				onChange(doc.exists() ? (doc.data() as UserSettings) : null),
			(error) => console.error("Error subscribing to settings", error),
		);
}

export async function updateUserSettings(
	userId: string,
	patch: Partial<UserSettings>,
): Promise<void> {
	await db
		.collection(C.userSettings)
		.doc(userId)
		.set(
			{
				...patch,
				userId,
				updatedAt: firestore.FieldValue.serverTimestamp(),
			},
			{ merge: true },
		);
}

/* ------------------------------------------------------------- app config */

/** Read before sign-in by the launch gate. */
export async function getRequiredVersion(): Promise<string | null> {
	try {
		const doc = await db
			.collection(APP_DATA.collection)
			.doc(APP_DATA.doc)
			.get();
		const value = doc.data()?.required_version;
		return typeof value === "string" ? value : null;
	} catch (e) {
		console.error("Error getting required version", e);
		return null;
	}
}

export async function getAppConfig(): Promise<{
	activeVersion: number;
	maintenance: boolean;
	message: string;
}> {
	// Imported, not repeated. A safety value with two definitions is a value
	// that will eventually disagree with itself.
	const fallback = {
		activeVersion: FALLBACK_ACTIVE_SCHEMA_VERSION,
		maintenance: false,
		message: "",
	};
	try {
		const doc = await db
			.collection(APP_CONFIG.collection)
			.doc(APP_CONFIG.doc)
			.get();
		if (!doc.exists()) return fallback;

		const data = doc.data();
		return {
			activeVersion:
				typeof data?.activeVersion === "number"
					? data.activeVersion
					: fallback.activeVersion,
			maintenance: data?.maintenance === true,
			message: typeof data?.message === "string" ? data.message : "",
		};
	} catch (e) {
		console.error("Error getting app config", e);
		return fallback;
	}
}
