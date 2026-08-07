/*
 * Where a fire-and-forget write's failure goes.
 *
 * Field mutations (clock in/out, pause, resume) no longer await their promise.
 * They cannot: with Firestore's native persistence the write lands on disk and
 * raises its snapshot immediately, but the PROMISE resolves only on server
 * acknowledgement — so offline it never settles, and awaiting it was what left
 * `isBusy` stuck true forever with no toast and no way out.
 *
 * Dropping the promise entirely would be worse: a genuine rejection (a rules
 * denial, a malformed document) would vanish silently. So every such write is
 * handed here instead, which is the one place that knows what to do with it.
 *
 * THIS IS FOR ERROR REPORTING, NOT FOR THE "UNSYNCED" BADGE. The counter below
 * is in-memory and resets on process restart, while Firestore's mutation queue
 * is on disk and does not. After a force-quit this reads zero while writes are
 * still genuinely pending. The durable per-document signal is
 * `metadata.hasPendingWrites` — see src/types/sync.ts.
 */

export type PendingWriteState = {
	/** In-flight writes this process has issued and not yet seen settle. */
	count: number;
	/** The most recent rejection, for diagnostics. Never auto-cleared. */
	lastError: Error | null;
};

type Listener = (state: PendingWriteState) => void;

let state: PendingWriteState = { count: 0, lastError: null };
const listeners = new Set<Listener>();

function emit() {
	for (const listener of [...listeners]) {
		try {
			listener(state);
		} catch (e) {
			console.error("Pending-write listener threw", e);
		}
	}
}

/**
 * Adopt a write's promise.
 *
 * `label` identifies the operation in logs — pass the service function's name
 * ("clockOut", "setItemState"), since the stack trace of a rejected Firestore
 * promise points into the SDK and says nothing about the caller.
 *
 * Returns nothing on purpose. A caller that could await this would await it.
 */
export function track(label: string, promise: Promise<unknown>): void {
	state = { ...state, count: state.count + 1 };
	emit();

	promise
		.catch((e: unknown) => {
			const error = e instanceof Error ? e : new Error(String(e));
			/*
			 * console.error, matching the convention every service already
			 * follows. @react-native-firebase/crashlytics is a dependency and
			 * would be the natural upgrade, but it has no call site anywhere in
			 * src/ today — a low-level utility is the wrong place to introduce
			 * the first one.
			 */
			console.error(`Deferred write failed: ${label}`, error);
			state = { ...state, lastError: error };
		})
		.finally(() => {
			state = { ...state, count: Math.max(0, state.count - 1) };
			emit();
		});
}

export function getPendingWriteState(): PendingWriteState {
	return state;
}

/** Fires on every change, and once immediately with the current value. */
export function subscribePendingWrites(listener: Listener): () => void {
	listeners.add(listener);
	listener(state);

	return () => {
		listeners.delete(listener);
	};
}
