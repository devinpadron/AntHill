/*
 * A key-value backend, injected rather than imported.
 *
 * Shared code under src/services/ needs to persist small amounts of state (the
 * SWR cache, the upload queue). It cannot import AsyncStorage to do it: the web
 * portal compiles src/services verbatim, and web/package.json has no
 * async-storage dependency and vite has no alias for it — so the import would
 * break `npm run build` in web/, and it would break it at the PORTAL build,
 * looking entirely unrelated to whatever app change caused it. The pre-commit
 * guard's rule 8 enforces the same boundary mechanically.
 *
 * So the platform registers a backend at startup and shared code asks for it:
 *   - index.js registers AsyncStorage before any provider mounts
 *   - web/src/main.tsx registers a localStorage adapter
 *
 * DELIBERATELY NOT UNDER src/services/, for the same reason as connectivity.ts:
 * it touches no Firestore API, so anything may import it.
 */

export type KvStore = {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
	removeItem(key: string): Promise<void>;
	getAllKeys(): Promise<readonly string[]>;
};

let store: KvStore | null = null;

export function registerKvStore(next: KvStore): void {
	store = next;
}

/**
 * The registered backend.
 *
 * THROWS if nothing registered one, rather than falling back to an in-memory
 * shim. UploadManagerContext already establishes the convention and the reason:
 * a default that silently no-ops turns "persistence was never wired up" into a
 * cache that quietly forgets everything on restart and an upload queue that
 * loses a shift's photos — a bug you find in production, from a user. A throw
 * is found on the first launch after the mistake.
 */
export function kv(): KvStore {
	if (!store) {
		throw new Error(
			"No KvStore registered. Call registerKvStore() at startup — " +
				"index.js for the app, web/src/main.tsx for the portal.",
		);
	}
	return store;
}

/** For tests and for the "did startup wire this up" check. */
export function hasKvStore(): boolean {
	return store !== null;
}
