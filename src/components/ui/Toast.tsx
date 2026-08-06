import React from "react";
import { StyleSheet, View } from "react-native";
import { Notifier, NotifierComponents } from "react-native-notifier";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics, Theme, useThemedStyles } from "../../theme";
import { ColorTokens } from "../../theme/themes";
import { Icon, IconName } from "./Icon";
import { Text } from "./Text";

/**
 * Transient feedback.
 *
 * The app confirmed and reported almost everything through `Alert.alert` —
 * roughly 70 call sites, including successes like "Your preferences have been
 * saved", which is a modal interruption for something the user can already see
 * happened. Those become toasts; `Alert` stays only for genuine decisions
 * ("Delete this checklist?").
 *
 * `toast.*` is callable from anywhere, including services and hooks, because it
 * drives the `NotifierWrapper` already mounted in `App.tsx` rather than
 * needing a hook of its own.
 */

type ToastTone = "success" | "error" | "warning" | "info";

const TONE: Record<ToastTone, { icon: IconName; color: keyof ColorTokens }> = {
	success: { icon: "checkmark-circle", color: "success" },
	error: { icon: "alert-circle", color: "danger" },
	warning: { icon: "warning", color: "warning" },
	info: { icon: "information-circle", color: "accent" },
};

const ToastBody: React.FC<{
	title?: string;
	description?: string;
	tone?: ToastTone;
}> = ({ title, description, tone = "info" }) => {
	const styles = useThemedStyles(toastStyles);
	const insets = useSafeAreaInsets();
	const { icon, color } = TONE[tone];

	return (
		/*
		 * `react-native-notifier` drops its banner from y=0, which puts it
		 * behind the notch or Dynamic Island. The inset is applied here rather
		 * than to the wrapper because the library owns the animated container.
		 */
		<View style={[styles.toast, { marginTop: insets.top + 8 }]}>
			<Icon name={icon} size="md" color={color} style={styles.icon} />
			<View style={styles.text}>
				{!!title && (
					<Text variant="bodyStrong" numberOfLines={2}>
						{title}
					</Text>
				)}
				{!!description && (
					<Text
						variant="caption"
						color="textSecondary"
						numberOfLines={3}
					>
						{description}
					</Text>
				)}
			</View>
		</View>
	);
};

const show = (
	tone: ToastTone,
	title: string,
	description?: string,
	onPress?: () => void,
) => {
	Notifier.showNotification({
		title,
		description,
		Component: ToastBody,
		componentProps: { tone },
		duration: tone === "error" ? 4500 : 3000,
		onPress,
	});
};

export const toast = {
	/** Something worked. Fires the success haptic with it. */
	success(title: string, description?: string) {
		haptics.success();
		show("success", title, description);
	},
	/** Something failed. */
	error(title: string, description?: string) {
		haptics.error();
		show("error", title, description);
	},
	/** Blocked but recoverable — validation, nothing selected. */
	warning(title: string, description?: string) {
		haptics.warning();
		show("warning", title, description);
	},
	/** Neutral news. No haptic — it was not the user's action. */
	info(title: string, description?: string, onPress?: () => void) {
		show("info", title, description, onPress);
	},
};

/** The foreground banner for an incoming push. */
export const PushToast = NotifierComponents.Notification;

const toastStyles = (theme: Theme) =>
	StyleSheet.create({
		toast: {
			flexDirection: "row",
			alignItems: "center",
			marginHorizontal: theme.spacing.md,
			padding: theme.spacing.md,
			borderRadius: theme.radius.lg,
			backgroundColor: theme.colors.surfaceRaised,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.border,
			...theme.elevation.floating,
		},
		icon: {
			marginRight: theme.spacing.md,
		},
		text: {
			flex: 1,
		},
	});
