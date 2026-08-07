import AsyncStorage from "@react-native-async-storage/async-storage";
import { OFFLINE_GRACE_MS } from "../constants/auth";

/*
 * The locally remembered session, and how long we keep trusting it offline.
 *
 * Two keys, on purpose:
 *
 *   AUTH_STATE ("true")   Unchanged from before. It gates the splash so a
 *                         returning user sees the app shell rather than the
 *                         login screen while Firebase answers. Left exactly as
 *                         it was so that a build WITHOUT this file — a rollback
 *                         — still reads it and behaves the way it always did.
 *
 *   AUTH_LAST_VERIFIED    New. {uid, at}: the last time the server actually
 *                         confirmed this account. The grace window is measured
 *                         from here.
 *
 * The uid is stored alongside the timestamp so grace cannot leak between
 * accounts. These devices get shared between staff; without the uid, signing in
 * as someone else would inherit whatever trust the previous user had banked.
 *
 * This uses AsyncStorage directly rather than lib/kvStore because it runs
 * before anything registers a backend — and because it is app-only, so the
 * portal-compatibility reason for the indirection does not apply.
 */

const AUTH_STATE_KEY = "AUTH_STATE";
const VERIFIED_KEY = "AUTH_LAST_VERIFIED";

export type AuthSession = {
	/** The optimistic "we had a session" flag behind the splash gate. */
	loggedIn: boolean;
	/** Who that session belonged to. Null on installs predating this key. */
	uid: string | null;
	/** When the server last confirmed it. Null if never recorded. */
	lastVerifiedAt: number | null;
};

const EMPTY: AuthSession = { loggedIn: false, uid: null, lastVerifiedAt: null };

export async function readAuthSession(): Promise<AuthSession> {
	try {
		const [[, state], [, verified]] = await AsyncStorage.multiGet([
			AUTH_STATE_KEY,
			VERIFIED_KEY,
		]);

		const session: AuthSession = { ...EMPTY, loggedIn: state === "true" };
		if (!verified) return session;

		const parsed = JSON.parse(verified) as {
			uid?: unknown;
			at?: unknown;
		};

		return {
			...session,
			uid: typeof parsed.uid === "string" ? parsed.uid : null,
			lastVerifiedAt: typeof parsed.at === "number" ? parsed.at : null,
		};
	} catch (e) {
		/*
		 * A corrupt or unreadable record must not be fatal. Reporting "no
		 * session" is the safe direction: the user sees the login screen and
		 * signs in, rather than the app throwing on launch.
		 */
		console.error("Failed to read auth session", e);
		return EMPTY;
	}
}

/** Records that the server confirmed this account, right now. */
export async function markVerified(uid: string): Promise<void> {
	try {
		await AsyncStorage.multiSet([
			[AUTH_STATE_KEY, "true"],
			[VERIFIED_KEY, JSON.stringify({ uid, at: Date.now() })],
		]);
	} catch (e) {
		console.error("Failed to save auth session", e);
	}
}

export async function clearAuthSession(): Promise<void> {
	try {
		await AsyncStorage.multiRemove([AUTH_STATE_KEY, VERIFIED_KEY]);
	} catch (e) {
		console.error("Failed to clear auth session", e);
	}
}

/**
 * Milliseconds of trust left. Zero once the window has closed.
 *
 * A session with no recorded verification time gets the FULL window rather than
 * none. That case is an install that upgraded into this code with AUTH_STATE
 * already set — the user was legitimately signed in, we simply never wrote the
 * timestamp — and expiring them on upgrade would be a mass logout caused by a
 * deploy. The next successful refresh records a real timestamp.
 */
export function graceRemainingMs(
	session: AuthSession,
	now: number = Date.now(),
): number {
	if (!session.loggedIn) return 0;
	if (session.lastVerifiedAt === null) return OFFLINE_GRACE_MS;

	return Math.max(0, session.lastVerifiedAt + OFFLINE_GRACE_MS - now);
}

/**
 * Whether `uid` may stay signed in without the server confirming it.
 *
 * The uid must match what was stored. A record belonging to someone else grants
 * nothing — see the note on shared devices above. A record with no uid at all
 * (pre-upgrade) is accepted, for the same reason graceRemainingMs is generous
 * about a missing timestamp.
 */
export function isWithinGrace(
	session: AuthSession,
	uid: string,
	now: number = Date.now(),
): boolean {
	if (session.uid !== null && session.uid !== uid) return false;
	return graceRemainingMs(session, now) > 0;
}
