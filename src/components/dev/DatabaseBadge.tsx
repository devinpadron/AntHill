import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DATABASE_LABEL, IS_PRODUCTION_DB } from "../../constants/database";
import { DIAGNOSTICS_MODE } from "../../constants/devFlags";
import { Icon, Text } from "../ui";
import { Theme, useThemedStyles } from "../../theme";

/**
 * Names the database this build talks to.
 *
 * `test` is a full copy of production, so the two are indistinguishable from
 * their contents — an event, a name, a time entry all look identical. Without a
 * marker there is no way to tell whether the thing on screen is real.
 *
 * TEST is muted: it is the safe case and the badge is on screen constantly.
 * PROD is loud, because a dev build pointed at real company data is the case
 * worth interrupting for.
 *
 * DEV-ONLY, ENFORCED HERE. `DATABASE_ID` already resolves to `test` only under
 * `__DEV__`, so this could never say TEST in a release — but it would still
 * render a PROD chip over a real user's app, so it returns null outright.
 *
 * Non-interactive on purpose (`pointerEvents="none"`): it floats over whatever
 * screen is mounted, and a dev affordance must never swallow a tap meant for
 * the app underneath.
 */
export const DatabaseBadge = () => {
	const styles = useThemedStyles(badgeStyles);
	const insets = useSafeAreaInsets();

	if (!__DEV__) return null;

	// The diagnostics harness draws its own, tappable, badge in this corner.
	if (DIAGNOSTICS_MODE) return null;

	return (
		<View
			pointerEvents="none"
			style={[styles.wrapper, { top: insets.top + 8 }]}
		>
			<View style={[styles.badge, IS_PRODUCTION_DB && styles.prod]}>
				<Icon
					name={IS_PRODUCTION_DB ? "warning" : "flask"}
					size="xs"
					color="#FFFFFF"
				/>
				<Text variant="caption" color="#FFFFFF" style={styles.label}>
					{DATABASE_LABEL}
				</Text>
			</View>
		</View>
	);
};

const badgeStyles = (theme: Theme) =>
	StyleSheet.create({
		wrapper: {
			position: "absolute",
			right: theme.spacing.sm,
			zIndex: 9999,
		},
		badge: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
			paddingHorizontal: theme.spacing.sm,
			paddingVertical: 3,
			borderRadius: theme.radius.pill,
			/*
			 * Fixed colours, not tokens. The point of this badge is that it
			 * looks like nothing else in the app in either theme — a themed
			 * chip would blend into the header it sits over.
			 */
			backgroundColor: "rgba(0, 0, 0, 0.55)",
		},
		prod: {
			backgroundColor: "#B3261E",
		},
		label: {
			fontSize: 10,
			fontWeight: "700",
			letterSpacing: 0.5,
		},
	});
