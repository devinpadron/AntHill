import React, { useState } from "react";
import { StyleSheet, Text, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormInput } from "../../../components/ui/FormInput";
import { Button } from "../../../components/ui/Button";
import { AntHill } from "../../../constants/colors";
import { useUser } from "../../../contexts/v2/UserContext";
import { useProfile } from "../../../hooks/v2/useProfile";

/*
 * Signed in, but not in any company.
 *
 * Three ways to end up here, and none of them used to lead anywhere: a manager
 * removes your last membership (removeMember clears loggedInCompanyId rather
 * than deleting the profile, precisely so this is recoverable), a signup fails
 * after the account is created but before the membership is written, or you
 * leave a company yourself.
 *
 * Before this, the tabs mounted with companyId undefined and every query ran
 * against an empty company id — which looks like a blank app that logged
 * permission errors, and gives no way back.
 */
const NoCompanyScreen = () => {
	const { logout } = useUser();
	const { joinCompany } = useProfile();
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);

	const join = async () => {
		const trimmed = code.trim();
		if (!trimmed) return;

		setBusy(true);
		try {
			const joined = await joinCompany(trimmed);
			if (!joined) {
				Alert.alert(
					"That code did not match",
					"Check the code with whoever invited you. Codes are case sensitive.",
				);
			}
			// On success the membership subscription sets companyId and this
			// screen unmounts on its own — nothing to navigate.
		} finally {
			setBusy(false);
		}
	};

	return (
		<SafeAreaView style={styles.container}>
			<Text style={styles.title}>You're not in a company yet</Text>
			<Text style={styles.body}>
				Enter the code you were given to join one. It can be a company
				code or a group code.
			</Text>

			<FormInput
				placeholder="Company or Group Code:"
				value={code}
				onChangeText={setCode}
			/>

			<Button
				title="Join"
				onPress={join}
				loading={busy}
				disabled={!code.trim() || busy}
				style={styles.primaryButton}
				textStyle={styles.buttonText}
				variant="primary"
				fullWidth
			/>

			<View style={{ height: 12 }} />

			<Button
				title="Sign out"
				onPress={logout}
				style={styles.textButton}
				textStyle={styles.linkText}
				variant="text"
			/>
		</SafeAreaView>
	);
};

export default NoCompanyScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "white",
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 24,
	},
	title: {
		fontSize: 20,
		fontWeight: "700",
		color: AntHill.Black,
		marginBottom: 8,
		textAlign: "center",
	},
	body: {
		fontSize: 14,
		color: "#666",
		lineHeight: 20,
		textAlign: "center",
		marginBottom: 24,
	},
	primaryButton: {
		height: 48,
		marginTop: 20,
		borderRadius: 8,
		width: "100%",
		backgroundColor: AntHill.Black,
	},
	buttonText: { fontSize: 18, fontWeight: "600", color: AntHill.White },
	textButton: { backgroundColor: "transparent", height: 40 },
	linkText: {
		fontSize: 16,
		color: AntHill.Black,
		textDecorationLine: "underline",
	},
});
