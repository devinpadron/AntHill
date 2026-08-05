import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { DATABASE_LABEL, IS_PRODUCTION_DB } from "../../constants/database";

/**
 * Names the database this build talks to, and opens the diagnostics screen.
 *
 * `test` is a full copy of production, so the two are indistinguishable from
 * their contents — an event, a name, a time entry all look identical. Without a
 * label there is no way to tell whether an edit is about to land on real
 * company data.
 *
 * PROD is deliberately loud. TEST is muted, because that is the safe case and
 * the badge is on screen constantly.
 *
 * DEV-ONLY, ENFORCED HERE. Today it can only render inside the DIAGNOSTICS_MODE
 * harness, which is itself `__DEV__ &&` gated — but that is safety by position,
 * and position changes. At cutover the v2 tree moves into the real
 * AppNavigator, and this returning null on its own is what stops it travelling
 * with it into a build users see.
 */
export const DiagnosticsBadge = () => {
	const navigation = useNavigation<any>();

	if (!__DEV__) return null;

	return (
		<TouchableOpacity
			style={[styles.badge, IS_PRODUCTION_DB ? styles.prod : styles.test]}
			onPress={() => navigation.navigate("Diagnostics")}
			accessibilityLabel={`Connected to the ${DATABASE_LABEL} database. Opens diagnostics.`}
		>
			<Text style={styles.text}>
				v2 · {DATABASE_LABEL}
				{IS_PRODUCTION_DB ? "  ⚠" : ""}
			</Text>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	badge: {
		position: "absolute",
		top: 60,
		right: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 14,
		zIndex: 999,
	},
	test: { backgroundColor: "rgba(0,0,0,0.55)" },
	prod: { backgroundColor: "#B3261E" },
	text: { color: "#fff", fontSize: 11, fontWeight: "700" },
});
