import React from "react";
import { StyleSheet, View } from "react-native";
import { Theme, useThemedStyles } from "../../theme";
import { useAppGate } from "../../hooks/useAppGate";
import { openAppStore } from "../../utils/versionUtils";
import { Button } from "./Button";
import { Loading } from "./Loading";
import { Logo } from "./Logo";
import { Screen } from "./Screen";
import { Text } from "./Text";

/**
 * Blocks the app when the backend says this build must not run.
 *
 * Children are not mounted until the gate resolves to "ok", so no provider
 * mounts, no listener attaches, and no write is issued by a build that is
 * meant to be locked out. That guarantee is what makes a schema cutover safe —
 * a dismissible alert rendered over a live app tree does not provide it.
 */
export const AppGate: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const styles = useThemedStyles(gateStyles);
	const {
		status,
		currentVersion,
		requiredVersion,
		message,
		isChecking,
		recheck,
	} = useAppGate();

	if (status === "ok") {
		return <>{children}</>;
	}

	if (status === "loading") {
		return (
			<View style={styles.loading}>
				<Logo width={180} height={90} style={styles.logo} />
				<Loading fill={false} size="small" />
			</View>
		);
	}

	/*
	 * A schema mismatch is a server-state condition, not something the user
	 * can fix — so it reads like maintenance and offers a retry, not a trip to
	 * the App Store. After a rollback the build they would need is OLDER, and
	 * "Update Now" would send them somewhere that cannot help.
	 */
	const isSchema = status === "schema";
	const isMaintenance = status === "maintenance";
	const isRetryable = isMaintenance || isSchema;

	return (
		<Screen edges={["top", "bottom"]}>
			<View style={styles.content}>
				<Logo width={180} height={90} style={styles.logo} />

				<Text variant="title" align="center" style={styles.title}>
					{isRetryable ? "AntHill is updating" : "Update required"}
				</Text>

				<Text
					variant="body"
					color="textSecondary"
					align="center"
					style={styles.body}
				>
					{isRetryable
						? message ||
							"We're making some improvements and will be back shortly. Your data is safe."
						: /*
							 * Versions are named ONLY when the version is the
							 * reason. Printing them under a schema gate made a
							 * correct comparison look broken.
							 */
							`You're on version ${currentVersion}${
								requiredVersion
									? `, and version ${requiredVersion} is required`
									: ""
							}. Please update AntHill to continue.`}
				</Text>

				<Button
					title={isRetryable ? "Try again" : "Update now"}
					onPress={isRetryable ? recheck : openAppStore}
					loading={isRetryable && isChecking}
					icon={isRetryable ? "refresh" : "arrow-up-circle-outline"}
					size="large"
					fullWidth
				/>
			</View>
		</Screen>
	);
};

const gateStyles = (theme: Theme) =>
	StyleSheet.create({
		loading: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: theme.colors.bg,
		},
		content: {
			flex: 1,
			width: "100%",
			paddingHorizontal: theme.spacing["2xl"],
			alignItems: "center",
			justifyContent: "center",
		},
		logo: {
			marginBottom: theme.spacing["2xl"],
		},
		title: {
			marginBottom: theme.spacing.md,
		},
		body: {
			marginBottom: theme.spacing["2xl"],
			maxWidth: 340,
		},
	});
