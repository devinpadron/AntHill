import { Platform } from "react-native";
import notifee, {
	AndroidImportance,
	AuthorizationStatus,
} from "@notifee/react-native";
import { ClockOutReminderTrigger } from "../types";

/*
 * On-device notifications.
 *
 * Everything else the app notifies about is a server push: a Cloud Function
 * decides, FCM delivers, NotificationContext routes. A geofence transition
 * cannot work that way. It is detected by the OS on the phone, often with no
 * network, and the reminder has to appear within seconds of the worker walking
 * through the door. There is no server in that loop, so there has to be a local
 * notifier.
 *
 * Notifee rather than expo-notifications because expo-notifications wants
 * ownership of the FCM token, which @react-native-firebase/messaging already
 * holds in NotificationContext. Two libraries competing for the token is how
 * push silently stops working on one platform.
 *
 * These notifications carry the same `data` shape as the server pushes, so a tap
 * lands in NotificationContext.handleNotificationNavigation unchanged and there
 * is one routing table rather than two.
 */

const CHANNEL_ID = "clock-reminders";

/**
 * Android requires a channel before anything can be displayed, and creating one
 * is idempotent — so this runs on every post rather than being sequenced into
 * app startup, where a background wake would have skipped it.
 *
 * IMPORTANCE_HIGH, deliberately: the reminder is worth nothing if it lands
 * silently in the shade and is read at the end of the shift, which is exactly
 * when it is too late to act on.
 */
async function ensureChannel(): Promise<string> {
	return notifee.createChannel({
		id: CHANNEL_ID,
		name: "Clock reminders",
		description:
			"Reminders to clock in when you arrive and out when you leave",
		importance: AndroidImportance.HIGH,
	});
}

/**
 * Asks for permission to post notifications.
 *
 * Separate from messaging().requestPermission() in NotificationContext even
 * though on iOS they end up at the same OS prompt: Android 13+ gates local
 * notifications behind POST_NOTIFICATIONS, which the FCM call does not request.
 * Returns whether we may actually post.
 */
export async function requestNotificationPermission(): Promise<boolean> {
	try {
		const settings = await notifee.requestPermission();
		return (
			settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
			settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
		);
	} catch (e) {
		console.error("Error requesting notification permission", e);
		return false;
	}
}

async function post(title: string, body: string): Promise<void> {
	try {
		const channelId = await ensureChannel();

		await notifee.displayNotification({
			title,
			body,
			/*
			 * screenName/type mirror the FCM payload contract so the tap handler
			 * in NotificationContext routes this the same way it routes a server
			 * push. "Clock" is the tab; the Clock stack opens on TimeEntryScreen.
			 */
			data: { type: "clock_reminder", screenName: "Clock" },
			/*
			 * No smallIcon: Notifee falls back to ic_launcher, which prebuild
			 * always generates. Naming a drawable the project does not ship
			 * gets you a blank square in the status bar and an error in logcat.
			 */
			android: {
				channelId,
				pressAction: { id: "default", launchActivity: "default" },
			},
			ios: { sound: "default" },
		});
	} catch (e) {
		console.error("Error displaying local notification", e);
	}
}

/** Arrived at the company's site and not on the clock. */
export function notifyClockInReminder(label: string | null): Promise<void> {
	const place = label ? `at ${label}` : "at work";
	return post(
		`You're ${place}`,
		"Don't forget to clock in — AntHill won't do it for you.",
	);
}

/**
 * Still on the clock at the moment the company says a shift usually ends.
 *
 * The wording follows the trigger, because the same sentence is wrong in the
 * other mode: "Leaving the shop?" makes no sense to someone who has just pulled
 * back into the yard, and "Back at the shop?" makes none to someone driving
 * away from it.
 */
export function notifyClockOutReminder(
	label: string | null,
	trigger: ClockOutReminderTrigger = "leaving",
): Promise<void> {
	const place = label ?? "work";

	if (trigger === "returning") {
		return post(
			`Back at ${place}?`,
			"You're still clocked in. Don't forget to clock out when you're done.",
		);
	}

	return post(
		`Leaving ${place}?`,
		"You're still clocked in. Don't forget to clock out when you're done.",
	);
}

/**
 * Clears any reminder still sitting in the shade.
 *
 * Called when the worker actually clocks in or out. A notification telling
 * someone to do a thing they have already done reads as the app not knowing
 * what is going on, which is how people learn to ignore it.
 */
export async function dismissClockReminders(): Promise<void> {
	try {
		await notifee.cancelAllNotifications();
	} catch (e) {
		console.error("Error dismissing local notifications", e);
	}
}

/**
 * Whether local notifications can be posted at all right now.
 *
 * iOS reports NOT_DETERMINED before the first ask; Android below 13 has no
 * runtime gate and reports authorized. Used to decide whether enabling the
 * geofence is worth doing rather than to block it.
 */
export async function hasNotificationPermission(): Promise<boolean> {
	try {
		const settings = await notifee.getNotificationSettings();
		return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
	} catch (e) {
		console.error("Error reading notification settings", e);
		return Platform.OS === "android";
	}
}
