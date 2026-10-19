import {
	NOTIFICATION_CHANNELS,
	type NotificationChannel,
	type NotificationPreferences,
} from "@app/types";

/*
 * A one-line summary of someone's push settings. Mirrors the app's
 * EmployeeList: named categories rather than a count, because "2 of 4 off"
 * tells a manager nothing about whether this person will see tomorrow's
 * assignment.
 *
 * Read-only on purpose, here and in the app: silencing someone else's phone is
 * not a manager's call. A manager chasing someone who never replies needs to
 * know whether they are ignoring the app or simply not being told — those look
 * identical from the outside.
 */
export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
	events: "shifts",
	availability: "availability",
	timesheets: "timesheets",
	teamMembers: "joins and departures",
	availabilityConfirmed: "availability confirmations",
	availabilityDeclined: "availability declines",
};

export function mutedChannels(
	prefs: NotificationPreferences,
): NotificationChannel[] {
	return NOTIFICATION_CHANNELS.filter((channel) => !prefs[channel]);
}

export function describeNotifications(prefs: NotificationPreferences): string {
	if (!prefs.enabled) return "Notifications off — will not be alerted";
	const muted = mutedChannels(prefs);
	if (muted.length === 0) return "All notifications on";
	return `Muted: ${muted.map((c) => CHANNEL_LABELS[c]).join(", ")}`;
}
