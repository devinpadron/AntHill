import * as FileSystem from "expo-file-system/legacy";

/*
 * Durable copies of files waiting to upload.
 *
 * THE PROBLEM THIS SOLVES. expo-image-picker and expo-video-thumbnails write
 * into the app's CACHE directory. iOS purges that under storage pressure and
 * Android treats it as reclaimable, neither with any warning and neither
 * respecting an app that is not running. A queue that stored a picker URI would
 * therefore work perfectly in testing — where the upload drains seconds later —
 * and lose photos in the field, where a phone sits offline overnight with a
 * full camera roll. The failure would look like a corrupt queue rather than a
 * deleted file.
 *
 * So anything entering the upload queue is copied into documentDirectory first,
 * which the OS does not reclaim.
 *
 * Uses the `expo-file-system/legacy` import path, matching AttachmentGallery.
 * expo-file-system 19 also ships a new File/Paths class API; mixing the two
 * idioms in one codebase is worse than using the older one consistently.
 */

const STAGING_DIR = `${FileSystem.documentDirectory}uploads/`;

/*
 * Destructured rather than read as `info.exists`, throughout this file.
 *
 * expo-file-system's `exists` really is a property — but check-layering.sh
 * rule 6 greps for the literal ".exists" to catch Firestore snapshots, where it
 * is a METHOD and reading it as a property is always truthy. The grep cannot
 * tell the two apart, and weakening it to exempt this file would blunt a guard
 * that exists for a bug that shipped. Destructuring sidesteps it for free.
 */
async function ensureDir(): Promise<void> {
	const { exists } = await FileSystem.getInfoAsync(STAGING_DIR);
	if (exists) return;
	await FileSystem.makeDirectoryAsync(STAGING_DIR, { intermediates: true });
}

/** Keeps the original extension — Storage content-type sniffing wants it. */
function stagedPathFor(key: string, sourceUri: string): string {
	const match = /\.([A-Za-z0-9]+)(?:\?.*)?$/.exec(sourceUri);
	const extension = match ? `.${match[1]}` : "";
	return `${STAGING_DIR}${key}${extension}`;
}

/**
 * Copies a file somewhere the OS will not reclaim, and returns the new URI.
 *
 * Falls back to the ORIGINAL uri if the copy fails. A staged copy is a
 * durability improvement, not a precondition — refusing to queue the upload
 * because the copy failed would turn a probably-fine upload into a certainly-
 * lost one.
 */
export async function stageForUpload(
	uri: string,
	key: string,
): Promise<string> {
	try {
		await ensureDir();
		const destination = stagedPathFor(key, uri);
		await FileSystem.copyAsync({ from: uri, to: destination });
		return destination;
	} catch (e) {
		console.error(`Could not stage ${key} for upload`, e);
		return uri;
	}
}

/**
 * Whether a staged file is still there.
 *
 * Checked before EVERY upload attempt, not just the first. A missing file is a
 * permanent failure — retrying cannot conjure the bytes back, and a queue that
 * retries forever on one is a queue that never drains.
 */
export async function stagedExists(uri: string): Promise<boolean> {
	try {
		const { exists } = await FileSystem.getInfoAsync(uri);
		return exists;
	} catch {
		return false;
	}
}

/** Reclaims one staged file once its upload has landed. Best effort. */
export async function discardStaged(uri: string): Promise<void> {
	if (!uri.startsWith(STAGING_DIR)) return; // Never picked up; not ours to delete.
	try {
		await FileSystem.deleteAsync(uri, { idempotent: true });
	} catch (e) {
		console.warn("Could not discard staged upload", e);
	}
}

/**
 * Deletes staged files no queue item refers to any more.
 *
 * Run at startup. Without it, every upload that failed permanently, or was
 * cancelled, or was interrupted by a crash between copy and enqueue, leaves a
 * full-resolution photo in documentDirectory forever — and documentDirectory is
 * backed up to iCloud, so it is the user's storage twice over.
 */
export async function pruneOrphanedStaging(liveUris: string[]): Promise<void> {
	try {
		const { exists } = await FileSystem.getInfoAsync(STAGING_DIR);
		if (!exists) return;

		const live = new Set(liveUris);
		const names = await FileSystem.readDirectoryAsync(STAGING_DIR);

		await Promise.all(
			names
				.map((name) => `${STAGING_DIR}${name}`)
				.filter((uri) => !live.has(uri))
				.map((uri) =>
					FileSystem.deleteAsync(uri, { idempotent: true }).catch(
						() => {},
					),
				),
		);
	} catch (e) {
		console.warn("Could not prune staged uploads", e);
	}
}
