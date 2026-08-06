import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Icon, Input, Screen, Text } from "../../components/ui";
import { useUser } from "../../contexts/UserContext";
import { useProfile } from "../../hooks/useProfile";
import { Theme, useThemedStyles } from "../../theme";

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
	const styles = useThemedStyles(noCompanyStyles);
	const { logout } = useUser();
	const { joinCompany } = useProfile();
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();

	const join = async () => {
		const trimmed = code.trim();
		if (!trimmed) return;

		setBusy(true);
		setError(undefined);
		try {
			const joined = await joinCompany(trimmed);
			if (!joined) {
				setError(
					"That code did not match. Check it with whoever invited you — codes are case sensitive.",
				);
			}
			// On success the membership subscription sets companyId and this
			// screen unmounts on its own — nothing to navigate.
		} finally {
			setBusy(false);
		}
	};

	return (
		<Screen scroll keyboard="avoid" contentContainerStyle={styles.content}>
			<View style={styles.iconWell}>
				<Icon name="business-outline" size="xl" color="accent" />
			</View>

			<Text variant="title" align="center" style={styles.title}>
				You're not in a company yet
			</Text>
			<Text
				variant="body"
				color="textSecondary"
				align="center"
				style={styles.body}
			>
				Enter the code you were given to join one. It can be a company
				code or a group code.
			</Text>

			<Input
				label="Company or group code"
				placeholder="Given to you by your manager"
				icon="key-outline"
				value={code}
				onChangeText={(v) => {
					setCode(v);
					setError(undefined);
				}}
				error={error}
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="go"
				onSubmitEditing={join}
				containerStyle={styles.field}
			/>

			<Button
				title="Join company"
				onPress={join}
				loading={busy}
				disabled={!code.trim() || busy}
				size="large"
				fullWidth
				haptic="press"
			/>

			<Button
				title="Sign out"
				onPress={logout}
				variant="text"
				icon="log-out-outline"
				style={styles.signOut}
			/>
		</Screen>
	);
};

export default NoCompanyScreen;

const noCompanyStyles = (theme: Theme) =>
	StyleSheet.create({
		content: {
			flexGrow: 1,
			justifyContent: "center",
			alignItems: "center",
			paddingHorizontal: theme.spacing.xl,
			paddingVertical: theme.spacing["2xl"],
		},
		iconWell: {
			width: 72,
			height: 72,
			borderRadius: theme.radius.pill,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: theme.colors.accentSubtle,
			marginBottom: theme.spacing.xl,
		},
		title: {
			marginBottom: theme.spacing.sm,
		},
		body: {
			maxWidth: 340,
			marginBottom: theme.spacing.xl,
		},
		field: {
			width: "100%",
			maxWidth: 420,
			marginBottom: theme.spacing.lg,
		},
		signOut: {
			marginTop: theme.spacing.xl,
		},
	});
