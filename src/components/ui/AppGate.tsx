import React from "react";
import { View, Text, Image, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { AntHill } from "../../constants/colors";
import { useAppGate } from "../../hooks/useAppGate";
import { openAppStore } from "../../utils/versionUtils";

const LOGO = require("../../assets/AntHill/Full_Black.png");

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
			<View style={styles.container}>
				<Image source={LOGO} style={styles.logo} resizeMode="contain" />
				<ActivityIndicator color={AntHill.Green} />
			</View>
		);
	}

	const isMaintenance = status === "maintenance";

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.content}>
				<Image source={LOGO} style={styles.logo} resizeMode="contain" />

				<Text style={styles.title}>
					{isMaintenance ? "AntHill is updating" : "Update Required"}
				</Text>

				<Text style={styles.body}>
					{isMaintenance
						? message ||
							"We're making some improvements and will be back shortly. Your data is safe."
						: `You're on version ${currentVersion}${
								requiredVersion
									? `, and version ${requiredVersion} is required`
									: ""
							}. Please update AntHill to continue.`}
				</Text>

				<Button
					title={isMaintenance ? "Try Again" : "Update Now"}
					onPress={isMaintenance ? recheck : openAppStore}
					loading={isMaintenance && isChecking}
					size="large"
					fullWidth
					style={styles.button}
				/>
			</View>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: AntHill.Cream,
		alignItems: "center",
		justifyContent: "center",
	},
	content: {
		width: "100%",
		paddingHorizontal: 32,
		alignItems: "center",
	},
	logo: {
		width: 180,
		height: 90,
		marginBottom: 32,
	},
	title: {
		fontSize: 24,
		fontWeight: "600",
		color: AntHill.Black,
		marginBottom: 12,
		textAlign: "center",
	},
	body: {
		fontSize: 16,
		lineHeight: 22,
		color: AntHill.Black,
		opacity: 0.75,
		textAlign: "center",
		marginBottom: 32,
	},
	button: {
		backgroundColor: AntHill.Green,
	},
});
