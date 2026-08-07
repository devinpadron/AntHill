/*
 * How fresh a snapshot is.
 *
 * Firestore's native persistence is enabled by default, so every listener is
 * served from the disk cache the instant it attaches and every write lands
 * locally before it reaches the server. That is what makes the app work
 * offline — but it also means a screen cannot tell, from the data alone,
 * whether it is showing the server's view or a local one.
 *
 * This is that missing channel. Services pass it as a TRAILING callback
 * argument, following the `onChange(events, cursor)` precedent in
 * eventService.subscribeEventsInRange, so existing callers keep working
 * untouched.
 *
 * No SDK import, so anything may use it — including the web portal, whose
 * Firestore shim now surfaces the same two flags.
 */

export type SnapshotSync = {
	/**
	 * The snapshot came from the local cache, not the server.
	 *
	 * True while offline, and briefly on every cold start before the first
	 * server response lands. On its own it is NOT a reason to show an error —
	 * cached data is usually correct data.
	 */
	fromCache: boolean;

	/**
	 * This document has local writes that the server has not acknowledged.
	 *
	 * The durable "not synced yet" signal: it comes from Firestore's own
	 * disk-backed mutation queue, so it survives a force-quit and stays true
	 * until the write actually lands. Drives the "Saving…" indicator.
	 *
	 * Reading this requires `{ includeMetadataChanges: true }` on the
	 * subscription — without it the acknowledgement raises no new snapshot (the
	 * document did not change) and this stays stuck true forever.
	 */
	hasPendingWrites: boolean;
};

/** What a subscription reports before its first snapshot arrives. */
export const UNKNOWN_SYNC: SnapshotSync = {
	fromCache: true,
	hasPendingWrites: false,
};
