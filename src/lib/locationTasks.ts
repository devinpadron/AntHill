import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { TrackPoint } from "../types";
import {
	appendSegment,
	distanceBetween,
	MAX_POINTS_PER_SEGMENT,
	setTrackStatus,
} from "../services/locationTrackService";
import {
	appendToBuffer,
	bumpSeq,
	clearBuffer,
	clearSession,
	readBuffer,
	readGeofenceState,
	readSession,
	writeGeofenceState,
} from "./locationSession";
import {
	notifyClockInReminder,
	notifyClockOutReminder,
} from "./localNotifications";

/*
 * The two background tasks.
 *
 * THESE MUST BE DEFINED AT MODULE SCOPE, and this module must be imported for
 * its side effect from App.tsx. When the OS wakes the app to hand over a
 * location or a geofence crossing, it boots the JS bundle and immediately looks
 * for a task registered under the name it was given. If the definition sits
 * inside a component, a hook, or an effect, it has not run at that moment and
 * the event is dropped — silently, in a context with no UI to report it. This
 * is the single most common way background location "just stops working".
 *
 * Neither task may touch React. There is no tree, no navigator and no context
 * when they run. Everything they need comes from lib/locationSession, which the
 * foreground keeps up to date on disk.
 *
 * Neither task may clock anybody in or out. The geofence posts a reminder and
 * that is the whole of its authority — see the note above the geofence task.
 */

export const LOCATION_TASK = "anthill-shift-location";
export const GEOFENCE_TASK = "anthill-clock-geofence";

/** Fixes worse than this are noise, not position. Metres. */
const ACCURACY_FLOOR_M = 100;

/** Flush the buffer once it has been open this long. */
const MAX_BUFFER_AGE_MS = 10 * 60 * 1000;

/**
 * A shift longer than this stops recording itself.
 *
 * One forgotten clock-out would otherwise track a worker until their battery
 * died — overnight, at home, for as long as the phone lasted. The entry is
 * marked completed and the session dropped; the time entry itself is left
 * alone, because closing someone's timesheet on a guess is not this code's
 * decision to make.
 */
const MAX_SESSION_MS = 16 * 60 * 60 * 1000;

/** Notify at most once per direction per half hour. */
const GEOFENCE_COOLDOWN_MS = 30 * 60 * 1000;

/* ----------------------------------------------------------- shift tracking */

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
	if (error) {
		console.error("Location task error", error);
		return;
	}

	const locations = (data as { locations?: Location.LocationObject[] })
		?.locations;
	if (!locations?.length) return;

	const session = await readSession();

	/*
	 * No session means the foreground has already decided we should not be
	 * recording — clocked out, permission withdrawn, company switched the
	 * feature off. The OS can still deliver a batch it had queued, so stopping
	 * here is a normal path, not an error.
	 */
	if (!session) {
		await stopTracking();
		return;
	}

	if (Date.now() - session.startedAt > MAX_SESSION_MS) {
		console.warn("Location session exceeded its cap; stopping");
		setTrackStatus(session.entryId, "completed");
		await stopTracking();
		await clearSession();
		await clearBuffer();
		return;
	}

	const existing = await readBuffer();
	const previous =
		existing?.entryId === session.entryId
			? (existing.points[existing.points.length - 1] ?? null)
			: null;

	const kept = filterFixes(locations, previous, session.minDistanceMeters);
	if (!kept.length) return;

	const buffer = await appendToBuffer(session.entryId, kept);

	const full = buffer.points.length >= MAX_POINTS_PER_SEGMENT;
	const stale = Date.now() - buffer.openedAt >= MAX_BUFFER_AGE_MS;
	if (!full && !stale) return;

	await flushBuffer();
});

/**
 * Drops fixes that are noise or that have not moved far enough to be worth a
 * point.
 *
 * The OS honours `distanceInterval` loosely — it will hand over a cluster of
 * fixes from a stationary phone drifting inside its own error radius — so the
 * distance rule is applied again here rather than trusted to the platform. The
 * threshold is half the configured interval: filtering at the full interval
 * would compound with the OS's own filter and drop real movement.
 */
function filterFixes(
	locations: Location.LocationObject[],
	previous: TrackPoint | null,
	minDistanceMeters: number,
): TrackPoint[] {
	const threshold = Math.max(10, minDistanceMeters / 2);
	const kept: TrackPoint[] = [];
	let last = previous;

	for (const location of locations) {
		const accuracy = location.coords.accuracy ?? Number.POSITIVE_INFINITY;
		if (accuracy > ACCURACY_FLOOR_M) continue;

		const point: TrackPoint = {
			t: location.timestamp,
			lat: location.coords.latitude,
			lng: location.coords.longitude,
			acc: Math.round(accuracy),
			spd: location.coords.speed ?? null,
		};

		if (last && distanceBetween(last, point) < threshold) continue;

		kept.push(point);
		last = point;
	}

	return kept;
}

/**
 * Writes whatever is buffered as a segment, then clears the buffer.
 *
 * The order matters and is the reason segment ids are deterministic:
 * appendSegment queues its write to local disk synchronously, so by the time
 * the buffer is cleared the points are durable in Firestore's mutation queue.
 * If the process dies between the two, the next launch replays the same points
 * under the same segment id and overwrites rather than duplicating.
 *
 * Exported because clock-out needs the tail of the shift written before the
 * session goes away.
 */
export async function flushBuffer(): Promise<void> {
	const [session, buffer] = await Promise.all([readSession(), readBuffer()]);
	if (!session || !buffer?.points.length) return;
	if (buffer.entryId !== session.entryId) {
		// Left over from a previous shift. Dropping it is correct: it cannot be
		// credited to this entry and its own entry has already been closed out.
		await clearBuffer();
		return;
	}

	appendSegment(
		session.companyId,
		session.entryId,
		session.userId,
		session.nextSeq,
		buffer.points,
	);

	await bumpSeq(session.entryId, session.nextSeq + 1);
	await clearBuffer();
}

/** Idempotent. Safe to call when nothing is running. */
export async function stopTracking(): Promise<void> {
	try {
		const running =
			await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
		if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
	} catch (e) {
		console.error("Error stopping location updates", e);
	}
}

/* --------------------------------------------------------------- geofencing */

/*
 * IT NEVER TOUCHES THE CLOCK.
 *
 * The entire behaviour is a notification. Auto clock-in was considered and
 * rejected by the person who asked for this: a phone that clips the corner of
 * the fence on the way past would open a shift nobody worked, and payroll would
 * be arguing about it a fortnight later. A missed reminder costs a nudge; an
 * automatic punch costs trust in the timesheet.
 */
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
	if (error) {
		console.error("Geofence task error", error);
		return;
	}

	const { eventType } = (data ?? {}) as {
		eventType?: Location.GeofencingEventType;
	};
	if (eventType === undefined) return;

	const entering = eventType === Location.GeofencingEventType.Enter;

	const state = await readGeofenceState();

	/*
	 * Which crossing means what, and it depends on the company.
	 *
	 * Arriving off the clock always means "clock in" — that one is universal.
	 * The clock-OUT nudge is the configurable half:
	 *
	 *   leaving   — a shop. Work happens here, so walking away ends the shift.
	 *
	 *   returning — a staging site. Crew load up, drive to the venue, work it,
	 *               and come back to unload. Leaving is the start of the job;
	 *               a "leaving" nudge would tell them to clock out on the way
	 *               to every single event. Coming back is the end.
	 *
	 * Under "returning" an ENTER therefore does double duty, and the clock
	 * state is what separates the two readings of the same crossing.
	 */
	const remindClockIn = entering && !state.hasActiveEntry;
	const remindClockOut =
		state.hasActiveEntry &&
		(state.clockOutTrigger === "leaving" ? !entering : entering);

	if (!remindClockIn && !remindClockOut) return;

	const kind = remindClockIn ? "in" : "out";

	/*
	 * A phone resting near the boundary crosses it repeatedly as the fix
	 * wanders. Without this the feature is a notification loop, and a worker who
	 * mutes it once has muted the reminder that was supposed to help them.
	 *
	 * Keyed on WHICH REMINDER, not on the crossing direction, and checked after
	 * working out which one is due. Under "returning" both reminders come from
	 * an ENTER, so a direction-keyed cooldown conflated them: a crew that got
	 * the clock-in nudge on arrival, loaded up and were back inside half an hour
	 * had their clock-out nudge silently swallowed — the exact turnaround this
	 * mode exists to serve.
	 */
	if (
		state.lastNotified === kind &&
		Date.now() - state.lastNotifiedAt < GEOFENCE_COOLDOWN_MS
	) {
		return;
	}

	if (remindClockIn) await notifyClockInReminder(state.label);
	else await notifyClockOutReminder(state.label, state.clockOutTrigger);

	await writeGeofenceState({
		lastNotified: kind,
		lastNotifiedAt: Date.now(),
	});
});

/** Idempotent. Safe to call when nothing is running. */
export async function stopGeofencing(): Promise<void> {
	try {
		const running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
		if (running) await Location.stopGeofencingAsync(GEOFENCE_TASK);
	} catch (e) {
		console.error("Error stopping geofencing", e);
	}
}
