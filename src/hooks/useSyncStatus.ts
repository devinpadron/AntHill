import { useEffect, useState } from "react";
import {
	Connectivity,
	getConnectivity,
	subscribeConnectivity,
} from "../lib/connectivity";
import {
	getPendingWriteState,
	subscribePendingWrites,
} from "../services/offline/pendingWrites";

/*
 * One answer to "are we connected, and is anything waiting to go out".
 *
 * Deliberately a single hook feeding a single banner. Per-screen offline
 * indicators are how an app ends up with five that disagree — and the honest
 * message is the same everywhere, because Firestore's queue is app-wide rather
 * than per screen.
 *
 * What this is NOT: a reason to block the UI. The app works offline. The banner
 * exists so a worker knows their clock-out is sitting on the phone rather than
 * on the server, not to tell them to stop.
 */

export type SyncStatus = {
	connectivity: Connectivity;
	/** We have positively determined there is no connection. */
	isOffline: boolean;
	/**
	 * Writes issued this session that have not been acknowledged.
	 *
	 * Resets on process restart, unlike Firestore's own on-disk queue — so a
	 * zero here is NOT proof everything synced. It is a live activity hint. The
	 * durable per-document signal is a snapshot's hasPendingWrites.
	 */
	pendingWrites: number;
};

export function useSyncStatus(): SyncStatus {
	const [connectivity, setConnectivity] =
		useState<Connectivity>(getConnectivity);
	const [pendingWrites, setPendingWrites] = useState(
		() => getPendingWriteState().count,
	);

	useEffect(() => subscribeConnectivity(setConnectivity), []);

	useEffect(
		() => subscribePendingWrites((state) => setPendingWrites(state.count)),
		[],
	);

	return {
		connectivity,
		isOffline: connectivity === "offline",
		pendingWrites,
	};
}
