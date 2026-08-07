import React from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "./Icon";
import { Text } from "./Text";
import { useSyncStatus } from "../../hooks/useSyncStatus";
import { Theme, useThemedStyles } from "../../theme";

/**
 * A thin strip saying we are offline and that work is being kept.
 *
 * Rendered by `Screen`, so every screen gets the same one in the same place and
 * no screen has to remember to add it. Only one Screen is mounted and visible
 * at a time, so this is effectively a single instance.
 *
 * The wording matters as much as the indicator. The app's previous offline
 * message was "Check your connection.", which read as "that didn't work" — but
 * with Firestore's queue the action DID work, it simply has not left the phone.
 * Telling a worker their clock-out failed when it did not is how you get them
 * tapping it four more times.
 *
 * Warning tone, never danger: this is a state to be aware of, not a problem to
 * fix. Most of these users have no way to fix it where they are standing.
 */
export const OfflineBanner: React.FC = () => {
	const styles = useThemedStyles(bannerStyles);
	const { isOffline } = useSyncStatus();

	if (!isOffline) return null;

	return (
		<View style={styles.bar} accessibilityRole="alert">
			<Icon name="cloud-offline" size={14} color="warning" />
			<Text variant="caption" style={styles.label}>
				Offline — your work is saved and will sync automatically
			</Text>
		</View>
	);
};

const bannerStyles = (theme: Theme) =>
	StyleSheet.create({
		bar: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: theme.spacing.xs,
			paddingVertical: theme.spacing.xs,
			paddingHorizontal: theme.spacing.md,
			backgroundColor: theme.colors.warningSubtle,
		},
		label: {
			color: theme.colors.warning,
		},
	});
