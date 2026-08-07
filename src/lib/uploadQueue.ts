import { kv } from "./kvStore";
import { DATABASE_ID } from "../constants/database";
import { AttachmentParentType } from "../types";

/*
 * Uploads waiting to leave the device.
 *
 * Firestore queues its own writes offline, on disk, surviving a force-quit —
 * which is why the clock works in a basement with no extra machinery. FIREBASE
 * STORAGE HAS NO SUCH QUEUE. A photo attached to a time entry with no signal
 * was simply thrown away, behind a "No internet connection" error, at the exact
 * moment a worker was documenting something they will be asked about later.
 *
 * This is that missing queue. It holds METADATA only — the bytes stay on disk
 * under src/lib/uploadStaging.ts — so a few hundred entries cost tens of
 * kilobytes.
 *
 * Persistence goes through lib/kvStore rather than AsyncStorage directly, so
 * this file stays importable from the shared tree. See kvStore's header.
 */

export type QueuedUpload = {
	/**
	 * The attachment document id, and therefore the idempotency key.
	 *
	 * Storage paths are derived from it too (attachmentService.storagePathFor),
	 * so replaying an interrupted upload overwrites the same object and patches
	 * the same document. A crash mid-upload costs bandwidth, never correctness.
	 */
	id: string;
	companyId: string;
	parentType: AttachmentParentType;
	parentId: string;
	ownerUserId: string;
	fieldId: string | null;

	/** STAGED uris, not the picker's originals. See uploadStaging. */
	fileUri: string;
	thumbnailUri: string | null;

	storagePath: string;
	thumbnailStoragePath: string | null;

	fileName: string;
	contentType: string;
	sizeBytes: number;
	width: number | null;
	height: number | null;

	attempts: number;
	lastError: string | null;
	enqueuedAt: number;
	/** Epoch ms before which this must not be retried. Drives the backoff. */
	nextAttemptAt: number;
};

/*
 * Namespaced by database, exactly as the SWR cache is.
 *
 * A dev build talks to a database literally named "test". Sharing one key with
 * production would let a dev queue drain into real company storage — the
 * precise bleed src/constants/database.ts exists to prevent.
 */
const QUEUE_KEY = `UPLOAD_QUEUE_V1::${DATABASE_ID}`;

/** Oldest-first eviction ceiling, so a permanently offline device stays bounded. */
const MAX_QUEUE = 200;

const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 15 * 60 * 1000;

/** Give up after this many tries; the attachment is marked failed. */
export const MAX_ATTEMPTS = 8;

type Listener = (size: number) => void;
const listeners = new Set<Listener>();

/*
 * Every mutation runs through this chain.
 *
 * The queue is one JSON blob under one key, so two concurrent
 * read-modify-writes lose whichever finishes first — and the two callers most
 * likely to race are "enqueue a new photo" and "the drain just finished one",
 * which is to say the common case. Serializing is not optional.
 */
let tail: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
	const run = tail.then(work, work);
	tail = run.catch(() => {});
	return run;
}

async function read(): Promise<QueuedUpload[]> {
	try {
		const raw = await kv().getItem(QUEUE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as QueuedUpload[]) : [];
	} catch (e) {
		/*
		 * A corrupt blob must not wedge uploads forever. Reporting an empty
		 * queue loses the pending list, but the staged FILES are still on disk
		 * and the attachment documents still say "pending", so the loss is
		 * visible rather than silent.
		 */
		console.error("Could not read upload queue", e);
		return [];
	}
}

async function write(items: QueuedUpload[]): Promise<void> {
	const trimmed =
		items.length > MAX_QUEUE
			? items.slice(items.length - MAX_QUEUE)
			: items;

	try {
		await kv().setItem(QUEUE_KEY, JSON.stringify(trimmed));
	} catch (e) {
		console.error("Could not write upload queue", e);
	}

	for (const listener of [...listeners]) {
		try {
			listener(trimmed.length);
		} catch (e) {
			console.error("Upload queue listener threw", e);
		}
	}
}

export function loadQueue(): Promise<QueuedUpload[]> {
	return serialize(read);
}

/** Adds items, replacing any existing entry with the same id. */
export function enqueue(items: QueuedUpload[]): Promise<void> {
	return serialize(async () => {
		if (!items.length) return;
		const incoming = new Set(items.map((item) => item.id));
		const existing = (await read()).filter(
			(item) => !incoming.has(item.id),
		);
		await write([...existing, ...items]);
	});
}

export function dequeue(id: string): Promise<void> {
	return serialize(async () => {
		const items = await read();
		const next = items.filter((item) => item.id !== id);
		if (next.length !== items.length) await write(next);
	});
}

/**
 * Records a failed attempt and schedules the next one.
 *
 * Exponential from 30s to a 15 minute ceiling. Returns the updated item so the
 * caller can see whether it has run out of attempts.
 */
export function markAttempt(
	id: string,
	error?: string,
): Promise<QueuedUpload | null> {
	return serialize(async () => {
		const items = await read();
		const item = items.find((candidate) => candidate.id === id);
		if (!item) return null;

		item.attempts += 1;
		item.lastError = error ?? null;
		item.nextAttemptAt =
			Date.now() +
			Math.min(
				BASE_BACKOFF_MS * 2 ** (item.attempts - 1),
				MAX_BACKOFF_MS,
			);

		await write(items);
		return item;
	});
}

/** Items whose backoff has elapsed, oldest first. */
export function dueItems(now: number = Date.now()): Promise<QueuedUpload[]> {
	return serialize(async () => {
		const items = await read();
		return items
			.filter((item) => item.nextAttemptAt <= now)
			.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
	});
}

/** Fires on every change, and once immediately with the current size. */
export function subscribeQueueSize(listener: Listener): () => void {
	listeners.add(listener);
	void loadQueue().then((items) => listener(items.length));

	return () => {
		listeners.delete(listener);
	};
}

export function clearQueue(): Promise<void> {
	return serialize(() => write([]));
}
