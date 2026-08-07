import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

/*
 * Connectivity, as one shared listener.
 *
 * Before this, NetInfo was called in exactly one place — a one-shot
 * `NetInfo.fetch()` pre-flight in UploadManagerContext that threw "No internet
 * connection" and dropped the work on the floor. Nothing else in the app knew
 * whether it was online, which is why a network blip could log a user out and
 * why a queued write had nothing to wait for.
 *
 * DELIBERATELY NOT UNDER src/services/. Two reasons:
 *   - it touches no Firestore API, so the layering guard's rule 1 does not
 *     apply and contexts, hooks and screens can import it directly;
 *   - the web portal compiles src/services verbatim, and NetInfo is a native
 *     module with no browser analogue. Keeping it out of services keeps it out
 *     of that bundle.
 *
 * This is a hint, not a truth. NetInfo reports "connected" on a captive-portal
 * wifi that answers nothing, and Firestore's own online state lags this by
 * several seconds. Use it to choose WORDING ("we'll sync later") and to trigger
 * retries. Never use it to gate a write — the whole design is that writes
 * always land locally and sync when they can.
 */

export type Connectivity = "online" | "offline" | "unknown";

type Listener = (state: Connectivity) => void;

/*
 * "unknown" until the first NetInfo event arrives, and unknown is treated as
 * ONLINE everywhere downstream.
 *
 * isInternetReachable is null until NetInfo finishes its first reachability
 * probe, which can take a second or two on a cold start. Treating that window
 * as offline would mean every launch briefly announced itself as offline and
 * anything gated on connectivity would stall on a probe that usually comes back
 * positive. Fail open.
 */
let current: Connectivity = "unknown";
const listeners = new Set<Listener>();
let unsubscribeNetInfo: (() => void) | null = null;

function classify(state: NetInfoState): Connectivity {
	if (!state.isConnected) return "offline";
	// null means "not probed yet" — only an explicit false is offline.
	if (state.isInternetReachable === false) return "offline";
	return "online";
}

function handle(state: NetInfoState) {
	const next = classify(state);
	if (next === current) return;

	current = next;
	// Copied before iterating: a listener may unsubscribe itself in response.
	for (const listener of [...listeners]) {
		try {
			listener(next);
		} catch (e) {
			console.error("Connectivity listener threw", e);
		}
	}
}

/*
 * One NetInfo subscription for the whole app, opened on first use.
 *
 * NetInfo starts a native reachability poll per listener, so a subscription per
 * caller is real battery cost. This is never torn down — connectivity is a
 * process-lifetime concern and there is no point where the app stops caring.
 */
function ensureStarted() {
	if (unsubscribeNetInfo) return;
	unsubscribeNetInfo = NetInfo.addEventListener(handle);
}

/** Last known connectivity. Synchronous, so it can be read inside a render. */
export function getConnectivity(): Connectivity {
	ensureStarted();
	return current;
}

/** True unless we have positively determined we are offline. */
export function isOnline(): boolean {
	return getConnectivity() !== "offline";
}

/** Fires on every change, and once immediately with the current value. */
export function subscribeConnectivity(listener: Listener): () => void {
	ensureStarted();
	listeners.add(listener);
	listener(current);

	return () => {
		listeners.delete(listener);
	};
}

/**
 * Fires on the offline -> online EDGE only.
 *
 * This is the retry trigger: queued uploads drain here, and the auth layer
 * re-checks email verification here. It deliberately does not fire on
 * subscribe, unlike subscribeConnectivity — a callback that runs a drain would
 * otherwise run it on every mount.
 */
export function onReconnect(callback: () => void): () => void {
	let previous = getConnectivity();

	return subscribeConnectivity((next) => {
		const reconnected = previous !== "online" && next === "online";
		previous = next;
		if (!reconnected) return;

		try {
			callback();
		} catch (e) {
			console.error("Reconnect handler threw", e);
		}
	});
}
