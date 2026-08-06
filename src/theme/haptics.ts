/**
 * Haptic feedback, behind one intent-named surface.
 *
 * Call sites say what happened (`haptics.success()`), not which generator to
 * fire, so the physical vocabulary stays consistent app-wide and can be retuned
 * in one place.
 *
 * Every call is fire-and-forget and swallows its own errors: haptics are a
 * garnish, and a device that cannot vibrate must never break a save.
 */

import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/*
 * Android's haptic engine is coarse enough that the light/selection tiers are
 * indistinguishable buzzes, which reads as noise rather than feedback. There,
 * only the meaningful ones (success/warning/error, medium impact) fire.
 */
const isIOS = Platform.OS === "ios";

const run = (fn: () => Promise<void>) => {
	fn().catch(() => {});
};

export const haptics = {
	/** Moving between discrete options: tabs, segments, checkboxes, pickers. */
	selection() {
		if (!isIOS) return;
		run(() => Haptics.selectionAsync());
	},

	/** A plain button press. */
	tap() {
		if (!isIOS) return;
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
	},

	/** A weightier press — opening a sheet, starting a drag, confirming. */
	press() {
		run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
	},

	/** Something completed: saved, submitted, clocked in, approved. */
	success() {
		run(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
		);
	},

	/** Blocked but recoverable: validation failed, nothing to submit. */
	warning() {
		run(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
		);
	},

	/** Something failed. */
	error() {
		run(() =>
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
		);
	},
};

export type Haptic = keyof typeof haptics;
