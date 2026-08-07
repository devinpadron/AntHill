import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import * as Location from "expo-location";
import {
	LocationPermissionLevel,
	LocationTrackStatus,
	TimeEntry,
} from "../types";
import { useUser } from "../contexts/UserContext";
import { useCompany } from "../contexts/CompanyContext";
import { recordLocationConsent } from "../services/userService";
import {
	nextSeq,
	setTrackStatus,
	startTrack,
} from "../services/locationTrackService";
import {
	GEOFENCE_TASK,
	LOCATION_TASK,
	flushBuffer,
	stopGeofencing,
	stopTracking,
} from "../lib/locationTasks";
import {
	clearBuffer,
	clearSession,
	readSession,
	writeGeofenceState,
	writeSession,
} from "../lib/locationSession";
import {
	hasNotificationPermission,
	requestNotificationPermission,
	dismissClockReminders,
} from "../lib/localNotifications";

/*
 * Starts and stops shift tracking, and keeps the geofence registered.
 *
 * This hook is the ONLY writer of the AsyncStorage mirror the background tasks
 * read. The tasks cannot see React state, so anything the foreground learns —
 * that a shift ended, that the company switched the feature off, that
 * permission was withdrawn — reaches them only because this reconciles it onto
 * disk. A background task using stale configuration is a missing write here.
 *
 * Two rules it must not break.
 *
 * THE CLOCK COMES FIRST. Nothing here may block, delay or fail a clock-in.
 * Consent and permission are resolved AFTER the entry exists, so a worker with
 * no signal and no patience still gets a timesheet. The cost is that the first
 * few seconds of a shift may go unrecorded, which is the right thing to trade.
 *
 * A REFUSAL IS A RESULT, NOT AN ERROR. Declining consent, denying permission
 * and having location services switched off are all normal outcomes. Each is
 * recorded on the entry so the manager sees a stated reason rather than an
 * empty map, and none of them stops the clock.
 */

/** What the OS will currently give us. */
async function readPermissionLevel(): Promise<LocationPermissionLevel> {
	try {
		const foreground = await Location.getForegroundPermissionsAsync();
		if (!foreground.granted) {
			return foreground.canAskAgain &&
				foreground.status === "undetermined"
				? "undetermined"
				: "denied";
		}

		const background = await Location.getBackgroundPermissionsAsync();
		return background.granted ? "always" : "whileInUse";
	} catch (e) {
		console.error("Error reading location permissions", e);
		return "denied";
	}
}

export function useLocationTracking(activeEntry: TimeEntry | null) {
	const { userId, companyId, settings } = useUser();
	const { preferences } = useCompany();

	const [permission, setPermission] =
		useState<LocationPermissionLevel>("undetermined");
	const [isRecording, setIsRecording] = useState(false);

	const trackingEnabled = preferences.locationTracking.enabled;
	const geofence = preferences.clockReminderGeofence;

	/*
	 * Consent is read from the user's own settings document rather than a local
	 * flag, so reinstalling the app does not silently erase the record that the
	 * disclosure happened. Undefined while settings are still loading, which is
	 * treated as "not yet" — the sheet appearing a beat late is better than
	 * recording before an answer.
	 */
	const hasConsent = Boolean(
		companyId && settings?.locationConsentByCompany?.[companyId],
	);

	/*
	 * Shifts where the worker said no.
	 *
	 * Declining does not write anything to userSettings — only agreement is
	 * recorded — so without this `hasConsent` stays false and the sheet
	 * reappears the instant it is dismissed. Held per ENTRY rather than
	 * globally: the question is asked at most once a shift, so a worker who
	 * declines is left alone for the rest of the day but is not silently opted
	 * out forever by one tap in a car park.
	 */
	const [declinedEntries, setDeclinedEntries] = useState<string[]>([]);

	/** The consent sheet is due. */
	const needsConsent = Boolean(
		trackingEnabled &&
		activeEntry &&
		companyId &&
		!hasConsent &&
		!declinedEntries.includes(activeEntry.id),
	);

	/*
	 * The last status written for each entry, so reconciliation does not rewrite
	 * "denied" on every render. Keyed by entry because a worker can clock in
	 * again after fixing their permissions and the second entry deserves its own
	 * answer.
	 */
	const writtenStatus = useRef<Record<string, LocationTrackStatus>>({});

	/**
	 * Writes a status, creating the summary only if there is not one already.
	 *
	 * `hasSummary` decides between the two writes and MUST be derived from the
	 * document, never from "is this the first call in this process". startTrack
	 * writes the whole object, counters included, so calling it on an entry that
	 * already has a summary resets pointCount, segmentCount and distanceMeters
	 * to zero.
	 *
	 * That is not hypothetical. A worker pausing for lunch stops the tracker; if
	 * the app is killed during the break — which it will be, it is an hour on a
	 * phone in a pocket — the in-memory guard below is gone, and resuming would
	 * have re-opened the track and wiped the morning's totals off a shift whose
	 * segments were all still sitting there.
	 */
	const recordStatus = useCallback(
		(entryId: string, status: LocationTrackStatus, hasSummary: boolean) => {
			if (writtenStatus.current[entryId] === status) return;
			writtenStatus.current[entryId] = status;
			if (hasSummary) setTrackStatus(entryId, status);
			else startTrack(entryId, status);
		},
		[],
	);

	useEffect(() => {
		readPermissionLevel().then(setPermission);
	}, [activeEntry?.id, trackingEnabled]);

	/* ------------------------------------------------- start / stop tracking */

	useEffect(() => {
		let cancelled = false;

		const reconcile = async () => {
			const session = await readSession();

			/*
			 * Stop for any reason at all: clocked out, on a break, feature
			 * switched off, permission withdrawn, or a clock-out performed on
			 * another device that arrived through subscribeActiveEntry.
			 *
			 * The buffer is flushed BEFORE the session is cleared, or the tail
			 * of the shift — everything since the last ten-minute flush — is
			 * thrown away at exactly the moment it matters most.
			 */
			const shouldRecord =
				trackingEnabled &&
				hasConsent &&
				permission === "always" &&
				activeEntry?.status === "active";

			if (!shouldRecord) {
				if (session) {
					await flushBuffer();
					await stopTracking();
					await clearSession();
					await clearBuffer();
					/*
					 * Only close out a track this hook actually opened. A paused
					 * shift keeps its "recording" status because it is going to
					 * resume; only a finished or abandoned one completes.
					 *
					 * `true` throughout: a session existing at all means the
					 * summary was opened when it started, so these must patch
					 * the status and leave the counters alone.
					 */
					if (activeEntry?.id !== session.entryId) {
						recordStatus(session.entryId, "completed", true);
					} else if (activeEntry.status !== "paused") {
						recordStatus(activeEntry.id, "completed", true);
					}
				}
				if (!cancelled) setIsRecording(false);
				return;
			}

			if (session?.entryId === activeEntry.id) {
				if (!cancelled) setIsRecording(true);
				return;
			}

			// A session belonging to a different entry: close it out first.
			if (session) {
				await flushBuffer();
				await clearBuffer();
				recordStatus(session.entryId, "completed", true);
			}

			const services = await Location.hasServicesEnabledAsync();
			if (!services) {
				recordStatus(
					activeEntry.id,
					"unavailable",
					activeEntry.locationTracking !== null,
				);
				if (!cancelled) setIsRecording(false);
				return;
			}

			await writeSession({
				companyId,
				userId,
				entryId: activeEntry.id,
				startedAt: activeEntry.clockInAt.toMillis(),
				minDistanceMeters:
					preferences.locationTracking.minDistanceMeters,
				/*
				 * Resumes after whatever is already on the server rather than
				 * restarting at zero, so a reinstall or a cleared buffer
				 * mid-shift appends instead of overwriting the morning.
				 */
				nextSeq: await nextSeq(activeEntry.id, 0),
			});

			try {
				await Location.startLocationUpdatesAsync(LOCATION_TASK, {
					/*
					 * Balanced, not Best. A shift route needs to show which
					 * building someone was at, not which side of the street —
					 * and Best keeps the GPS chip awake for the whole double.
					 */
					accuracy: Location.Accuracy.Balanced,
					distanceInterval:
						preferences.locationTracking.minDistanceMeters,
					timeInterval:
						preferences.locationTracking.minIntervalSeconds * 1000,
					/*
					 * iOS pauses updates when it decides the user has stopped
					 * moving, and it does not reliably start again — the shift
					 * simply stops recording halfway through with no error.
					 */
					pausesUpdatesAutomatically: false,
					/*
					 * The blue status bar is the POINT, not a cost. The worker
					 * being able to see at a glance that recording is on is
					 * half of what was promised them.
					 */
					showsBackgroundLocationIndicator: true,
					activityType: Location.ActivityType.Other,
					/*
					 * Android requires a foreground service for background
					 * location, and its persistent notification doubles as the
					 * same visible indicator iOS gets from the blue bar.
					 */
					foregroundService: {
						notificationTitle: "On the clock",
						notificationBody:
							"AntHill is recording your location for this shift",
					},
				});

				/*
				 * Resuming after a break re-enters here with a summary already
				 * on the document, so this patches the status rather than
				 * re-opening the track over the morning's counters.
				 */
				recordStatus(
					activeEntry.id,
					"recording",
					activeEntry.locationTracking !== null,
				);
				if (!cancelled) setIsRecording(true);
			} catch (e) {
				console.error("Error starting location updates", e);
				await clearSession();
				recordStatus(
					activeEntry.id,
					"unavailable",
					activeEntry.locationTracking !== null,
				);
				if (!cancelled) setIsRecording(false);
			}
		};

		reconcile();
		return () => {
			cancelled = true;
		};
	}, [
		activeEntry?.id,
		activeEntry?.status,
		trackingEnabled,
		hasConsent,
		permission,
		companyId,
		userId,
		preferences.locationTracking.minDistanceMeters,
		preferences.locationTracking.minIntervalSeconds,
		recordStatus,
	]);

	/* --------------------------------------------- record a refusal, plainly */

	/*
	 * A worker who agreed but whose phone will not grant Always.
	 *
	 * "undetermined" is excluded because we are still going to ask, and
	 * "declined" is not handled here — that comes from declineConsent, since
	 * only the sheet knows the difference between a refusal and a question that
	 * has not been put yet.
	 */
	useEffect(() => {
		if (!trackingEnabled || !hasConsent) return;
		if (activeEntry?.status !== "active") return;
		if (permission === "always" || permission === "undetermined") return;

		recordStatus(
			activeEntry.id,
			"denied",
			activeEntry.locationTracking !== null,
		);
	}, [
		trackingEnabled,
		activeEntry?.id,
		activeEntry?.status,
		hasConsent,
		permission,
		recordStatus,
	]);

	/* ------------------------------------------------------------- geofencing */

	/*
	 * Mirrored on every clock change, because the geofence task runs when there
	 * is NO session — which is exactly the case where a clock-in reminder is
	 * due — so it cannot infer clock state from the session being absent.
	 */
	useEffect(() => {
		writeGeofenceState({
			hasActiveEntry: Boolean(activeEntry),
			label: geofence.label ?? null,
			clockOutTrigger: geofence.clockOutTrigger,
		});
	}, [activeEntry?.id, geofence.label, geofence.clockOutTrigger]);

	/*
	 * Clearing the shade on an actual punch. A reminder telling someone to do
	 * what they have just done teaches them the app is not paying attention.
	 */
	useEffect(() => {
		dismissClockReminders();
	}, [activeEntry?.id]);

	useEffect(() => {
		let cancelled = false;

		const reconcileGeofence = async () => {
			const configured =
				geofence.enabled &&
				geofence.latitude !== null &&
				geofence.longitude !== null;

			if (!configured || permission !== "always") {
				await stopGeofencing();
				return;
			}

			if (!(await hasNotificationPermission())) {
				/*
				 * Monitoring regions we cannot notify about is pure battery
				 * cost. Left unregistered until the worker allows
				 * notifications, which the consent flow asks for.
				 */
				await stopGeofencing();
				return;
			}

			if (cancelled) return;

			try {
				await Location.startGeofencingAsync(GEOFENCE_TASK, [
					{
						latitude: geofence.latitude,
						longitude: geofence.longitude,
						radius: geofence.radiusMeters,
						notifyOnEnter: true,
						notifyOnExit: true,
					},
				]);
			} catch (e) {
				console.error("Error starting geofencing", e);
			}
		};

		reconcileGeofence();
		return () => {
			cancelled = true;
		};
	}, [
		geofence.enabled,
		geofence.latitude,
		geofence.longitude,
		geofence.radiusMeters,
		permission,
	]);

	/* ---------------------------------------------------------- consent flow */

	/**
	 * Runs after the worker accepts the in-app disclosure.
	 *
	 * The order is fixed by both stores and by iOS itself: the disclosure has
	 * already been shown by the caller, then foreground, and only then
	 * background — "Always" cannot be requested cold. Returns the level reached
	 * so the caller can explain a shortfall.
	 */
	const acceptConsent =
		useCallback(async (): Promise<LocationPermissionLevel> => {
			if (!companyId || !userId) return "denied";

			recordLocationConsent(userId, companyId);

			try {
				const foreground =
					await Location.requestForegroundPermissionsAsync();
				if (!foreground.granted) {
					setPermission("denied");
					return "denied";
				}

				const background =
					await Location.requestBackgroundPermissionsAsync();

				// Worth having even if background was refused — the geofence needs
				// it, and it is a separate prompt on every platform.
				await requestNotificationPermission();

				const level: LocationPermissionLevel = background.granted
					? "always"
					: "whileInUse";
				setPermission(level);
				return level;
			} catch (e) {
				console.error("Error requesting location permissions", e);
				setPermission("denied");
				return "denied";
			}
		}, [companyId, userId]);

	/**
	 * Records a refusal against the open entry.
	 *
	 * Deliberately durable. The manager reviewing this timesheet needs to see
	 * that there is no route because the worker said no, not to be left with a
	 * blank map to draw their own conclusions from.
	 */
	const declineConsent = useCallback(() => {
		if (!activeEntry) return;

		setDeclinedEntries((prev) =>
			prev.includes(activeEntry.id) ? prev : [...prev, activeEntry.id],
		);
		recordStatus(
			activeEntry.id,
			"declined",
			activeEntry.locationTracking !== null,
		);
	}, [activeEntry, recordStatus]);

	/**
	 * Android 11+ will not grant background location from a dialog at all — the
	 * request resolves denied and the only route is the system settings page.
	 */
	const openSettings = useCallback(() => {
		Linking.openSettings().catch((e) =>
			console.error("Error opening settings", e),
		);
	}, []);

	return {
		/** The company wants shifts tracked. */
		trackingEnabled,
		/** Points are being written right now. Drives the clock-screen indicator. */
		isRecording,
		permission,
		hasConsent,
		needsConsent,
		acceptConsent,
		declineConsent,
		openSettings,
	};
}
