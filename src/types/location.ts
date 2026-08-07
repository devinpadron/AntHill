import { CompanyScoped, Timestamp } from "./common";

/*
 * Shift location tracking.
 *
 * A worker's route between clock-in and clock-out, recorded on the device and
 * shown to their manager at review. Two things about the shape are deliberate
 * and load-bearing.
 *
 * FIRST: points are batched into SEGMENTS rather than written one document per
 * fix. An eight-hour shift sampled every minute is roughly five hundred points.
 * As documents that is five hundred writes into the offline mutation queue and
 * five hundred reads to draw one polyline. As a single document with an array
 * grown by arrayUnion it is a full rewrite of the array on every append —
 * quadratic bandwidth, and the 1 MiB document ceiling is genuinely reachable.
 * A segment is one bounded set(), it queues offline like any other write, and a
 * whole shift reads back in about five documents.
 *
 * SECOND: the summary on the parent entry carries a STATUS, not just counters.
 * An entry with no points because the worker denied permission and an entry
 * with no points because they never left the kitchen are indistinguishable from
 * the data alone, and a manager reviewing a timesheet will read an empty map as
 * evidence either way. The status is what stops the absence of a track being
 * presented as a fact about the worker.
 */

/**
 * One recorded fix.
 *
 * The keys are abbreviated because hundreds of these ride inside a single
 * document and Firestore charges for the field names in every one of them. This
 * is the only place in the schema where that trade is worth making — everywhere
 * else, spell it out.
 */
export interface TrackPoint {
	/** Epoch ms of the FIX, from the OS. Not the time it was flushed. */
	t: number;
	lat: number;
	lng: number;
	/** Horizontal accuracy in metres. Fixes worse than the floor are dropped. */
	acc: number;
	/** Metres per second, when the OS supplies it. */
	spd: number | null;
}

/**
 * timeEntries/{entryId}/locationSegments/{segmentId}
 *
 * Append-only, like `edits`. segmentId is `${entryId}-${seq padded to 4}` so a
 * replayed flush overwrites its own segment rather than duplicating it — the
 * background task can be killed between writing Firestore and clearing its
 * buffer, and on the next launch it will try again with the same points.
 */
export interface LocationSegment extends CompanyScoped {
	id: string;
	entryId: string;
	userId: string;
	/** Zero-based flush ordinal within the entry. Segments sort by it. */
	seq: number;
	startedAt: Timestamp;
	endedAt: Timestamp;
	points: TrackPoint[];
	schemaVersion: number;
}

/**
 * Why an entry does or does not have a route.
 *
 *   recording   — on the clock now, points still arriving
 *   completed   — the shift ended with tracking on; the route is whatever it is
 *   declined    — the worker said no to the in-app consent step
 *   denied      — the OS permission was refused, or downgraded below Always
 *   unavailable — location services off device-wide, or the OS stopped us
 *
 * Everything except `recording` and `completed` means "we could not look", and
 * the UI must say which rather than drawing an empty map.
 */
export type LocationTrackStatus =
	"recording" | "completed" | "declined" | "denied" | "unavailable";

/**
 * The summary denormalised onto the parent time entry.
 *
 * Counters are maintained with FieldValue.increment, never by writing an
 * absolute total. That is a transform: it queues offline, and the server
 * applies it to whatever the document actually holds — so a flush landing at
 * the same moment as clockOut cannot lose, and cannot cause clockOut to lose.
 * The same reasoning as resumeEntry in timeEntryService.
 */
export interface LocationTrackSummary {
	status: LocationTrackStatus;
	pointCount: number;
	segmentCount: number;
	/** Straight-line sum between consecutive kept points, in metres. */
	distanceMeters: number;
}

/** What the OS is currently willing to give us. */
export type LocationPermissionLevel =
	/** Background updates are allowed. The only level the shift track works at. */
	| "always"
	/** Foreground only — enough to see a map, not enough to record a shift. */
	| "whileInUse"
	| "denied"
	/** Not yet asked. Distinct from denied: it is still worth prompting. */
	| "undetermined";

/**
 * When the clock-OUT reminder fires. The clock-IN reminder is always on arrival.
 *
 * Two genuinely different businesses, and guessing wrong sends the reminder at
 * the exact moment it is wrong:
 *
 *   leaving  — a brick-and-mortar shift. Work happens AT the site, so walking
 *              away from it means the shift is over.
 *
 *   returning — a staging site. Crew load up, drive out to the venue, work the
 *              event, and come back to drop off. Leaving is the START of the
 *              work, not the end of it; the shift ends when they get back. A
 *              "leaving" reminder here nags them on the way to every job.
 */
export type ClockOutReminderTrigger = "leaving" | "returning";

/**
 * A company's single geofenced site.
 *
 * One site, not a list. iOS caps monitored regions at 20 per app and a catering
 * company has one commissary; a list would buy flexibility nobody asked for at
 * the cost of a CRUD screen and a region budget to manage.
 */
export interface ClockReminderGeofence {
	enabled: boolean;
	/** What the reminder calls the place. "the shop", "Commissary". */
	label: string | null;
	/** formatted_address from Google Places, shown back to the admin. */
	address: string | null;
	latitude: number | null;
	longitude: number | null;
	/**
	 * Metres. Below about 100 consumer GPS drifts across the boundary while the
	 * phone sits still, which turns the reminder into a notification loop.
	 */
	radiusMeters: number;
	/** Defaults to "leaving", which is what a shop-based company expects. */
	clockOutTrigger: ClockOutReminderTrigger;
}

/** How aggressively to sample while on the clock. */
export interface LocationTrackingSettings {
	enabled: boolean;
	/** Metres of movement before the OS hands us another fix. */
	minDistanceMeters: number;
	/** Floor on the gap between fixes, seconds. */
	minIntervalSeconds: number;

	/*
	 * The transparency settings below default ON, and that default is the
	 * important part — a company that never opens this screen gets the open
	 * behaviour, not the quiet one.
	 *
	 * Note what CANNOT be switched off, because it is not ours to switch off:
	 * iOS shows a blue status bar for the whole shift and Android requires a
	 * persistent foreground-service notification. Turning these off makes the
	 * app quieter about tracking; it does not make tracking invisible, and
	 * nothing here should be sold to a company as if it did.
	 */

	/**
	 * The "Recording your location for this shift" row on the clock screen.
	 *
	 * Off leaves the OS indicators as the only signal, which workers routinely
	 * do not connect to a specific app.
	 */
	showRecordingIndicator: boolean;

	/**
	 * Whether a worker can see their own route on their own timesheet.
	 *
	 * Managers see every route either way. Off means the person being recorded
	 * is the only party who cannot see the recording.
	 */
	workersSeeOwnRoutes: boolean;

	/**
	 * Whether the disclosure offers a real "no".
	 *
	 * The disclosure itself is NOT optional and has no switch: Google Play
	 * requires a prominent in-app disclosure before an app requests background
	 * location, and that requirement binds the whole app, not one company's
	 * configuration. Off turns the sheet into an acknowledgement — the worker
	 * is told, and taps OK — which keeps the app shippable while removing the
	 * opt-out. Consider local employment law before using it.
	 */
	allowDeclining: boolean;
}
