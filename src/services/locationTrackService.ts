import firestore from "@react-native-firebase/firestore";
import db from "../lib/db";
import { C } from "../constants/paths";
import {
	LocationSegment,
	LocationTrackStatus,
	LocationTrackSummary,
	TrackPoint,
} from "../types";
import { track } from "./offline/pendingWrites";

/*
 * Shift location tracks.
 *
 * Everything here is on the clock path, so it inherits the rules set out at the
 * top of timeEntryService and does not get to reinterpret them:
 *
 *   - WRITES ARE SYNCHRONOUS. They return once the mutation is on local disk and
 *     hand their promise to pendingWrites.track(). The caller is usually a
 *     background TaskManager task with no UI to spin, and a promise that only
 *     settles on server acknowledgement never settles at a venue with no signal.
 *
 *   - BUSINESS TIMESTAMPS ARE CLIENT-SIDE. serverTimestamp() reads back as null
 *     in every local snapshot, so a segment stamped by the server would be
 *     invisible to the device that wrote it — and the flusher reads its own
 *     segments back to decide what to write next.
 *
 *   - NO TRANSACTIONS. tx.get() bypasses the cache and fails outright offline.
 *
 * The counters on the parent entry are maintained with FieldValue.increment
 * rather than an absolute total. That is a transform: it queues offline like any
 * write, and the server applies it to whatever the document actually holds. A
 * flush landing at the same instant as clockOut therefore cannot lose its
 * points, and cannot cost clockOut its worked total.
 */

/** Points per segment document. See the note in types/location.ts. */
export const MAX_POINTS_PER_SEGMENT = 120;

/**
 * Ceiling on segments read back for one entry.
 *
 * The tracker caps a session at 16 hours and flushes at most every 10 minutes,
 * so a legitimate shift cannot exceed about a hundred segments. This is not a
 * paging cursor — it is the bound that stops a pathological entry from
 * streaming an unknown number of documents into a map view.
 */
const MAX_SEGMENTS_PER_ENTRY = 200;

const toSegment = (doc): LocationSegment => ({
	...(doc.data() as LocationSegment),
	id: doc.id,
});

/**
 * Deterministic segment id.
 *
 * The background task can be killed between the Firestore write landing and its
 * local buffer being cleared, and on the next launch it will replay the same
 * points. A deterministic id makes that replay overwrite its own segment
 * instead of duplicating the leg. The same trick `edits` uses.
 */
const segmentId = (entryId: string, seq: number) =>
	`${entryId}-${String(seq).padStart(4, "0")}`;

/** Metres between two fixes. Equirectangular — accurate enough well under a km. */
export function distanceBetween(a: TrackPoint, b: TrackPoint): number {
	const R = 6371000;
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const x = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
	const y = toRad(b.lat - a.lat);
	return Math.sqrt(x * x + y * y) * R;
}

/** Summed straight-line distance along an ordered run of points, in metres. */
export function pathDistance(points: TrackPoint[]): number {
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		total += distanceBetween(points[i - 1], points[i]);
	}
	return total;
}

/**
 * Writes one segment and folds it into the parent's summary. Not awaited.
 *
 * Both writes are queued together so they cannot diverge across a process
 * death: the segment and the counters it contributes to either both sit in the
 * mutation queue or neither does.
 */
export function appendSegment(
	companyId: string,
	entryId: string,
	userId: string,
	seq: number,
	points: TrackPoint[],
): void {
	if (!points.length) return;

	const ref = db
		.collection(C.timeEntries)
		.doc(entryId)
		.collection(C.locationSegments)
		.doc(segmentId(entryId, seq));

	const segment = {
		id: ref.id,
		companyId,
		entryId,
		userId,
		seq,
		startedAt: firestore.Timestamp.fromMillis(points[0].t),
		endedAt: firestore.Timestamp.fromMillis(points[points.length - 1].t),
		points,
		schemaVersion: 2,
	};

	track("appendLocationSegment", ref.set(segment));

	/*
	 * The distance credited here spans only THIS segment, so the metre or two
	 * between the last point of one segment and the first of the next is not
	 * counted. Deliberate: carrying the boundary point across would need the
	 * previous segment read back, which is a network round trip on the one code
	 * path that must never need one. The error is a rounding artefact against a
	 * shift measured in kilometres.
	 */
	track(
		"bumpLocationSummary",
		db
			.collection(C.timeEntries)
			.doc(entryId)
			.update({
				"locationTracking.pointCount": firestore.FieldValue.increment(
					points.length,
				),
				"locationTracking.segmentCount":
					firestore.FieldValue.increment(1),
				"locationTracking.distanceMeters":
					firestore.FieldValue.increment(
						Math.round(pathDistance(points)),
					),
				updatedAt: firestore.FieldValue.serverTimestamp(),
			}),
	);
}

/**
 * Opens the summary on an entry. Not awaited.
 *
 * Writes the WHOLE object, so the counters exist as numbers before any
 * increment lands on them — on a fresh entry `locationTracking` is null, and an
 * increment cannot create a field inside a map that does not exist.
 *
 * BECAUSE it writes the whole object, it RESETS the counters. Only ever call it
 * on an entry whose `locationTracking` is null; anything else wants
 * setTrackStatus. Getting this wrong zeroes the totals on a shift whose
 * segments are all still there, which reads as data loss and is not obviously
 * traceable to here.
 */
export function startTrack(entryId: string, status: LocationTrackStatus): void {
	const summary: LocationTrackSummary = {
		status,
		pointCount: 0,
		segmentCount: 0,
		distanceMeters: 0,
	};

	track(
		"startLocationTrack",
		db.collection(C.timeEntries).doc(entryId).update({
			locationTracking: summary,
			updatedAt: firestore.FieldValue.serverTimestamp(),
		}),
	);
}

/**
 * Moves an existing summary to a new status without touching its counters.
 *
 * A dotted path rather than a whole-object write, so a flush in flight cannot
 * be clobbered by a status change and vice versa.
 */
export function setTrackStatus(
	entryId: string,
	status: LocationTrackStatus,
): void {
	track(
		"setLocationTrackStatus",
		db.collection(C.timeEntries).doc(entryId).update({
			"locationTracking.status": status,
			updatedAt: firestore.FieldValue.serverTimestamp(),
		}),
	);
}

/** Every segment for an entry, in order. */
export async function getSegments(entryId: string): Promise<LocationSegment[]> {
	try {
		const snapshot = await db
			.collection(C.timeEntries)
			.doc(entryId)
			.collection(C.locationSegments)
			.orderBy("seq", "asc")
			.limit(MAX_SEGMENTS_PER_ENTRY)
			.get();

		return snapshot.docs.map(toSegment);
	} catch (e) {
		console.error("Error getting location segments", e);
		return [];
	}
}

/** Live segments for an entry. Synchronous unsubscribe. */
export function subscribeSegments(
	entryId: string,
	onChange: (segments: LocationSegment[]) => void,
): () => void {
	if (!entryId) return () => {};

	return db
		.collection(C.timeEntries)
		.doc(entryId)
		.collection(C.locationSegments)
		.orderBy("seq", "asc")
		.onSnapshot(
			(snapshot) => onChange(snapshot.docs.map(toSegment)),
			(error) =>
				console.error("Error subscribing to location segments", error),
		);
}

/**
 * The next unused segment ordinal for an entry.
 *
 * Read from Firestore rather than kept only in the local buffer, so a
 * reinstall or a cleared buffer mid-shift resumes after the segments already
 * written instead of overwriting them from zero. Falls back to the caller's own
 * count if the read fails, which offline it will — the local cache answers
 * first, and a wrong guess costs one overwritten segment, not the shift.
 */
export async function nextSeq(entryId: string, fallback: number) {
	try {
		const snapshot = await db
			.collection(C.timeEntries)
			.doc(entryId)
			.collection(C.locationSegments)
			.orderBy("seq", "desc")
			.limit(1)
			.get();

		if (snapshot.empty) return fallback;
		return ((snapshot.docs[0].data() as LocationSegment).seq ?? -1) + 1;
	} catch (e) {
		console.error("Error reading last location segment", e);
		return fallback;
	}
}
