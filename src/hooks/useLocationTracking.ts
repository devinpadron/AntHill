import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Linking } from "react-native";
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

/*
 * How long to keep asking the OS what it decided, after we have asked it for
 * Always and it has answered something else.
 *
 * On iOS the background request resolves as soon as the system has NOTED it —
 * the "Change to Always Allow?" dialog is shown afterwards, and often only once
 * the app has been backgrounded for a while, so the promise routinely reports
 * whileInUse for a shift the worker did in fact fully allow. There is no
 * permission-change event to subscribe to, so this is a short poll.
 *
 * Five seconds, not longer, because acceptConsent waits this out before
 * reporting a shortfall: the caller's warning must not be wrong, but a worker
 * whose phone really did refuse is owed the news while they are still looking
 * at the screen. Anything granted after the window still lands — the foreground
 * re-read below catches it.
 */
const PERMISSION_SETTLE_ATTEMPTS = 5;
const PERMISSION_SETTLE_INTERVAL_MS = 1000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * What the clock screen should say about location, if anything.
 *
 * Three states rather than two booleans, because the third one is the point:
 * "none" covers both "the company does not want this shown" and "we do not yet
 * know", and those must look identical — an unfinished check is not a finding.
 */
export type LocationIndicator = "recording" | "attention" | "none";

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

	/*
	 * Whether we are still waiting to find out what the OS did with a request we
	 * have already made. Suppresses the "denied" write below, so a worker who is
	 * mid-way through granting Always is not recorded as having refused.
	 */
	const [settlingPermission, setSettlingPermission] = useState(false);

	/*
	 * Whether the read below has come back yet for the CURRENT entry.
	 *
	 * `permission` cannot answer this on its own: its initial value is
	 * "undetermined", which is a real answer meaning "not asked yet", so a
	 * screen reading it during the first frames of a shift cannot tell an
	 * unasked worker from one whose phone we simply have not queried.
	 */
	const [permissionChecked, setPermissionChecked] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setPermissionChecked(false);

		readPermissionLevel().then((level) => {
			// A read belonging to the previous entry must not land on this one.
			if (cancelled) return;
			setPermission(level);
			setPermissionChecked(true);
		});

		return () => {
			cancelled = true;
		};
	}, [activeEntry?.id, trackingEnabled]);

	/*
	 * Permission can change while the app is running, and NOTHING tells us when.
	 *
	 * Both routes to Always end outside the promise we awaited: on Android 11+
	 * the grant only exists after a round trip to the system settings page, and
	 * on iOS the confirmation dialog is shown after the request has resolved.
	 * Without these two re-reads the hook holds whileInUse for the rest of the
	 * process — tracking never starts, the clock screen shows the "needs
	 * attention" row, and a relaunch appears to be the fix because a relaunch is
	 * the only thing that re-runs the read above.
	 */
	const appState = useRef(AppState.currentState);
	const watchesPermission = trackingEnabled || geofence.enabled;

	useEffect(() => {
		if (!watchesPermission) return;

		const subscription = AppState.addEventListener(
			"change",
			(next: AppStateStatus) => {
				const returnedToForeground =
					appState.current.match(/inactive|background/) &&
					next === "active";
				appState.current = next;

				if (returnedToForeground) {
					readPermissionLevel().then(setPermission);
				}
			},
		);

		return () => subscription.remove();
	}, [watchesPermission]);

	/**
	 * Waits out a provisional answer and resolves with the real one.
	 *
	 * Awaited rather than fired and forgotten, so a caller reporting a shortfall
	 * to the worker describes what the OS actually settled on. Telling someone
	 * their route will not record, two seconds before it starts recording, is
	 * how a working feature gets reported as broken.
	 */
	const settlePermission =
		useCallback(async (): Promise<LocationPermissionLevel> => {
			setSettlingPermission(true);
			let level: LocationPermissionLevel = "denied";

			try {
				for (let i = 0; i < PERMISSION_SETTLE_ATTEMPTS; i++) {
					await wait(PERMISSION_SETTLE_INTERVAL_MS);
					level = await readPermissionLevel();
					setPermission(level);
					if (level === "always") break;
				}
			} finally {
				setSettlingPermission(false);
			}

			return level;
		}, []);

	/* ------------------------------------------------- start / stop tracking */

	/*
	 * Whether the reconcile below is mid-flight.
	 *
	 * Starting the tracker is several awaits deep — read the session, ask
	 * whether location services are even on, look up the next segment number on
	 * the server, then hand off to the OS — so `isRecording` stays false for a
	 * second or two at the start of every shift while nothing at all is wrong.
	 */
	const [reconciling, setReconciling] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setReconciling(true);

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

		reconcile()
			.catch((e) => console.error("Error reconciling location", e))
			.finally(() => {
				if (!cancelled) setReconciling(false);
			});

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
	 * has not been put yet. A request still settling is excluded for the same
	 * reason: the answer we have is provisional, not a refusal.
	 */
	useEffect(() => {
		if (!trackingEnabled || !hasConsent) return;
		if (activeEntry?.status !== "active") return;
		if (permission === "always" || permission === "undetermined") return;
		if (settlingPermission) return;

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
		settlingPermission,
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
	 *
	 * Anything short of Always takes a few seconds longer to resolve, because
	 * that answer is provisional until settlePermission has confirmed it. The
	 * consent sheet does not wait on this — it closes on the recorded consent —
	 * so the delay is paid only by the caller's warning, which is exactly the
	 * thing that must not be wrong.
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

				if (background.granted) {
					setPermission("always");
					return "always";
				}

				/*
				 * Provisional: the OS may still be about to ask, or the worker
				 * may be on their way to the settings page. Report whileInUse
				 * now so the UI is not stuck on a stale level, then wait for
				 * the answer that counts.
				 */
				setPermission("whileInUse");
				return await settlePermission();
			} catch (e) {
				console.error("Error requesting location permissions", e);
				setPermission("denied");
				return "denied";
			}
		}, [companyId, userId, settlePermission]);

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

	/* ------------------------------------------------ what the worker is told */

	/*
	 * Everything above settles at a different moment, and for the first seconds
	 * of a shift NONE of it has settled: permission is still being read, and the
	 * tracker is still being handed to the OS. Rendering `isRecording` literally
	 * during that window told a worker whose phone was about to start recording
	 * "Location isn't being recorded. Tap to fix in Settings", and then took it
	 * back a second later. An accusation that retracts itself is worse than
	 * silence, and it trains people to ignore the row when it is real.
	 *
	 * So the row is resolved here, once, into what we are actually willing to
	 * SAY — and while anything is still settling we say either what the entry
	 * already recorded or nothing at all.
	 */
	const isResolving = !permissionChecked || settlingPermission || reconciling;

	/*
	 * The last status written for this entry, which is the cache: the summary
	 * lives on the document, so a shift that was recording a moment ago goes on
	 * saying so through a relaunch, a resume from break, or the gap while we
	 * re-check the OS. An entry with no summary yet — a clock-in a few seconds
	 * old — has nothing to fall back on, and gets silence.
	 *
	 * "declined" is deliberately NOT carried over into the warning: it is
	 * written the moment the sheet is refused, when permission is usually still
	 * "undetermined", and the resolved rule below stays quiet in that case. Only
	 * the two statuses that imply the OS was actually asked survive the gap.
	 */
	const cached = activeEntry?.locationTracking?.status ?? null;
	const cachedIndicator: LocationIndicator =
		cached === "recording"
			? "recording"
			: cached === "denied" || cached === "unavailable"
				? "attention"
				: "none";

	let locationIndicator: LocationIndicator = "none";
	if (
		trackingEnabled &&
		/*
		 * A company that has chosen to say nothing about location on the clock
		 * screen does not want a row about it appearing the moment something
		 * goes wrong either. Managers still see the refusal on the timesheet.
		 */
		preferences.locationTracking.showRecordingIndicator &&
		/*
		 * Paused shifts say nothing at all. Tracking is deliberately stopped for
		 * the break, so neither row is true: "recording" would be a lie, and
		 * pointing someone at the Settings app to fix a break is worse than one.
		 */
		activeEntry?.status === "active" &&
		!needsConsent
	) {
		if (isResolving) locationIndicator = cachedIndicator;
		else if (isRecording) locationIndicator = "recording";
		else if (permission !== "undetermined") locationIndicator = "attention";
	}

	return {
		/** The company wants shifts tracked. */
		trackingEnabled,
		/** Points are being written right now. Drives the clock-screen indicator. */
		isRecording,
		/**
		 * The one thing the clock screen should show, already resolved: never
		 * "attention" on the strength of a check that has not finished.
		 */
		locationIndicator,
		permission,
		hasConsent,
		needsConsent,
		acceptConsent,
		declineConsent,
		openSettings,
	};
}
