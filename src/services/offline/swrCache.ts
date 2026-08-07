import { kv } from "../../lib/kvStore";
import { DATABASE_ID } from "../../constants/database";

/*
 * A small persisted stale-while-revalidate cache.
 *
 * DELIBERATELY NARROW. Firestore's own disk cache already serves every
 * subscription the moment it attaches and every read that has been made before,
 * so putting an app-level cache in front of one is duplicated state that can
 * disagree with the SDK — worse than no cache at all. This exists for the one
 * shape Firestore's cache does not help with: a read that is EXPENSIVE TO
 * ASSEMBLE even when every document is already local.
 *
 * The motivating case is useUserStats, which pages up to 2,000 documents across
 * ten sequential round trips and deserialises all of them just to show a total.
 * Cached or not, that blocks the statistics screen on every cold launch.
 *
 * Do NOT reach for this for ordinary reads. If the data is behind an
 * onSnapshot, or is a single document, the SDK has already solved it.
 *
 * (The stats sweep is a stopgap, not an answer. RNFirebase v23 exposes
 * getAggregateFromServer with sum() and count(), billed per index entry rather
 * than per document — a sum("workedSeconds") aggregate, or a rollup document
 * maintained by a Cloud Function, would delete the need for this entirely.)
 */

type CacheEntry<T> = {
	value: T;
	storedAt: number;
	version: number;
};

export type SwrResult<T> = {
	value: T | null;
	storedAt: number | null;
	/** Past its TTL. Still returned — stale data beats a spinner. */
	isStale: boolean;
};

/** A miss and a stale hit are both "use this, then refresh" — only value differs. */
function miss<T>(): SwrResult<T> {
	return { value: null, storedAt: null, isStale: true };
}

/*
 * Every key carries the database it came from.
 *
 * A dev build reads and writes a database literally named "test". This repo
 * goes to real lengths to keep the two apart — a separate handle in lib/db, a
 * DatabaseBadge in the UI — and a shared cache key would quietly reintroduce
 * exactly the bleed those exist to prevent: dev data rendered in a production
 * build, or the reverse, with nothing on screen to say so.
 */
const PREFIX = `SWR::${DATABASE_ID}::`;

export type Cache<T> = {
	read(key: string): Promise<SwrResult<T>>;
	write(key: string, value: T): Promise<void>;
	invalidate(key: string): Promise<void>;
	clear(): Promise<void>;
};

export function createCache<T>(options: {
	/** Key namespace. Must be unique across caches. */
	name: string;
	/** Bump when the cached SHAPE changes — old entries are then ignored. */
	version: number;
	/** Past this age an entry is returned but flagged stale. */
	ttlMs: number;
}): Cache<T> {
	const { name, version, ttlMs } = options;
	const keyFor = (key: string) => `${PREFIX}${name}::${key}`;

	const cache: Cache<T> = {
		async read(key) {
			try {
				const raw = await kv().getItem(keyFor(key));
				if (!raw) return miss<T>();

				const entry = JSON.parse(raw) as CacheEntry<T>;
				/*
				 * A version bump silently invalidates rather than migrating.
				 * These are all re-derivable from Firestore, so the cost of
				 * being wrong is one slow screen; the cost of deserialising an
				 * old shape into new code is a crash.
				 */
				if (entry.version !== version) return miss<T>();

				return {
					value: entry.value,
					storedAt: entry.storedAt,
					isStale: Date.now() - entry.storedAt > ttlMs,
				};
			} catch (e) {
				console.error(`Could not read ${name} cache`, e);
				return miss<T>();
			}
		},

		async write(key, value) {
			try {
				const entry: CacheEntry<T> = {
					value,
					storedAt: Date.now(),
					version,
				};
				await kv().setItem(keyFor(key), JSON.stringify(entry));
			} catch (e) {
				// A cache that cannot write is slow, not broken.
				console.error(`Could not write ${name} cache`, e);
			}
		},

		async invalidate(key) {
			try {
				await kv().removeItem(keyFor(key));
			} catch (e) {
				console.error(`Could not invalidate ${name} cache`, e);
			}
		},

		async clear() {
			try {
				const keys = await kv().getAllKeys();
				const mine = keys.filter((key) =>
					key.startsWith(`${PREFIX}${name}::`),
				);
				await Promise.all(mine.map((key) => kv().removeItem(key)));
			} catch (e) {
				console.error(`Could not clear ${name} cache`, e);
			}
		},
	};

	return cache;
}

/**
 * Drops every cache under this prefix. Call on logout.
 *
 * These devices get handed between staff, and the cached data here is one
 * worker's hours and shifts. Leaving it for whoever signs in next is a real
 * incident, not a tidiness question.
 *
 * Scans the key space rather than tracking a registry of createCache() calls
 * on purpose. A registry only contains caches whose module happened to have
 * been imported, so a user who never opened the statistics screen this session
 * would sign out and leave the previous session's stats on disk — a leak that
 * depends on bundler import order, which is the worst kind to debug. Enumerating
 * keys cannot miss one.
 */
export async function clearAllCaches(): Promise<void> {
	try {
		const keys = await kv().getAllKeys();
		const mine = keys.filter((key) => key.startsWith(PREFIX));
		await Promise.all(mine.map((key) => kv().removeItem(key)));
	} catch (e) {
		console.error("Could not clear caches", e);
	}
}
