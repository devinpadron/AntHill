import AsyncStorage from "@react-native-async-storage/async-storage";
import { DATABASE_ID } from "../constants/database";
import { ClockOutReminderTrigger, TrackPoint } from "../types";

/*
 * What the background tasks are allowed to know.
 *
 * A TaskManager task can be invoked in a FRESH JS CONTEXT, minutes after the
 * app was swiped away, with no navigator, no React tree and no contexts. It
 * cannot call useCompany() or useUser(); it cannot read a module-level variable
 * that some screen set, because that screen never ran. Everything it needs has
 * to be on disk before it wakes.
 *
 * So this file is the contract between the foreground app and the background:
 * the foreground writes a mirror of the current session whenever it changes,
 * and the tasks read only from here. If a task appears to be using stale
 * configuration, the bug is a missing write in useLocationTracking, not a
 * missing read here.
 *
 * AsyncStorage directly, not lib/kvStore, for the same two reasons
 * lib/authSession gives: a background wake may run before anything registers a
 * kv backend, and this is app-only so the portal-compatibility argument for the
 * indirection does not apply.
 *
 * Keys are namespaced by DATABASE_ID for the reason lib/uploadQueue is: a dev
 * build talks to the `test` database, and a buffer written against a test entry
 * must never flush into production.
 */

const SESSION_KEY = `LOCATION_SESSION_V1::${DATABASE_ID}`;
const BUFFER_KEY = `LOCATION_BUFFER_V1::${DATABASE_ID}`;
const GEOFENCE_KEY = `LOCATION_GEOFENCE_V1::${DATABASE_ID}`;

/**
 * The shift currently being recorded.
 *
 * Null whenever nothing should be written: nobody clocked in, the company has
 * tracking off, consent was declined, permission was refused. The location task
 * treats a null session as "stop", not as "carry on with what you had".
 */
export type LocationSession = {
	companyId: string;
	userId: string;
	entryId: string;
	/** Epoch ms of clock-in. The hard-cap timer is measured from this. */
	startedAt: number;
	/** Mirrored from company preferences so the task need not read Firestore. */
	minDistanceMeters: number;
	/** Segment ordinal for the NEXT flush. */
	nextSeq: number;
};

/** Buffered points not yet written to a segment. */
export type LocationBuffer = {
	entryId: string;
	points: TrackPoint[];
	/** Epoch ms the oldest buffered point arrived; drives the age-based flush. */
	openedAt: number;
};

/**
 * Enough geofence state to answer "should this transition notify".
 *
 * `hasActiveEntry` is mirrored rather than derived, because the geofence task
 * runs when there is no session at all — that is precisely the case where a
 * clock-in reminder is due — so it cannot infer clock state from the session
 * being null versus absent.
 */
export type GeofenceState = {
	hasActiveEntry: boolean;
	label: string | null;
	/**
	 * Whether the clock-out nudge belongs on the way out or on the way back.
	 * Mirrored from company preferences, same as everything else here.
	 */
	clockOutTrigger: ClockOutReminderTrigger;
	/**
	 * Which reminder was last posted, for the cooldown.
	 *
	 * The REMINDER, not the crossing that caused it: under the "returning"
	 * trigger both reminders come from an ENTER, so keying this on direction
	 * made one suppress the other.
	 */
	lastNotified: "in" | "out" | null;
	lastNotifiedAt: number;
};

async function readJson<T>(key: string): Promise<T | null> {
	try {
		const raw = await AsyncStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch (e) {
		/*
		 * A corrupt record must not take a background task down with it. Every
		 * reader treats null as "not tracking", which is the safe direction:
		 * the worst case is a lost leg of a route, not a crash in a context
		 * with no UI to report it.
		 */
		console.error(`Failed to read ${key}`, e);
		return null;
	}
}

async function writeJson(key: string, value: unknown): Promise<void> {
	try {
		await AsyncStorage.setItem(key, JSON.stringify(value));
	} catch (e) {
		console.error(`Failed to write ${key}`, e);
	}
}

async function remove(key: string): Promise<void> {
	try {
		await AsyncStorage.removeItem(key);
	} catch (e) {
		console.error(`Failed to clear ${key}`, e);
	}
}

/* ------------------------------------------------------------- the session */

export const readSession = () => readJson<LocationSession>(SESSION_KEY);
export const writeSession = (session: LocationSession) =>
	writeJson(SESSION_KEY, session);
export const clearSession = () => remove(SESSION_KEY);

/** Advances the flush ordinal. No-op if the session moved on underneath. */
export async function bumpSeq(entryId: string, nextSeq: number) {
	const session = await readSession();
	if (!session || session.entryId !== entryId) return;
	await writeSession({ ...session, nextSeq });
}

/* -------------------------------------------------------------- the buffer */

export const readBuffer = () => readJson<LocationBuffer>(BUFFER_KEY);
export const clearBuffer = () => remove(BUFFER_KEY);

/**
 * Adds points to the buffer, discarding anything belonging to another entry.
 *
 * The entry check is what stops a late batch of fixes from a finished shift
 * being credited to the one that started after it — the OS can deliver a
 * location callback for updates it collected before we asked it to stop.
 */
export async function appendToBuffer(
	entryId: string,
	points: TrackPoint[],
): Promise<LocationBuffer> {
	const existing = await readBuffer();
	const base =
		existing && existing.entryId === entryId
			? existing
			: { entryId, points: [], openedAt: Date.now() };

	const next: LocationBuffer = {
		...base,
		points: [...base.points, ...points],
	};

	await writeJson(BUFFER_KEY, next);
	return next;
}

/* ------------------------------------------------------------ the geofence */

const EMPTY_GEOFENCE: GeofenceState = {
	hasActiveEntry: false,
	label: null,
	clockOutTrigger: "leaving",
	lastNotified: null,
	lastNotifiedAt: 0,
};

export async function readGeofenceState(): Promise<GeofenceState> {
	return (await readJson<GeofenceState>(GEOFENCE_KEY)) ?? EMPTY_GEOFENCE;
}

export async function writeGeofenceState(
	patch: Partial<GeofenceState>,
): Promise<void> {
	const current = await readGeofenceState();
	await writeJson(GEOFENCE_KEY, { ...current, ...patch });
}

export const clearGeofenceState = () => remove(GEOFENCE_KEY);

/**
 * Wipes every trace of a tracking session.
 *
 * Called on logout and on company switch. Location state is per-employer, and
 * leaving a buffer behind would mean the next person to sign in on a shared
 * device flushes someone else's movements into their own time entry.
 */
export async function clearAllLocationState(): Promise<void> {
	try {
		await AsyncStorage.multiRemove([SESSION_KEY, BUFFER_KEY, GEOFENCE_KEY]);
	} catch (e) {
		console.error("Failed to clear location state", e);
	}
}
