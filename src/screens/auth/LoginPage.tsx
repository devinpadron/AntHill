import React, { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button, Input, Logo, Screen, Text } from "../../components/ui";
import { showPrompt } from "../../utils/alertUtils";
import { useAuth } from "../../hooks/useAuth";
import { Theme, useThemedStyles } from "../../theme";

/*
 * Login.
 *
 * The form is vertically centered but lives in a keyboard-aware scroll view —
 * previously it was centered in a bare SafeAreaView with no keyboard handling
 * at all, so on a small phone the password field went under the keyboard.
 *
 * Errors render under the field that caused them rather than as alerts.
 */
const LoginPage = ({ navigation }) => {
	const styles = useThemedStyles(loginStyles);
	const passwordRef = useRef<TextInput>(null);

	const {
		email,
		setEmail,
		password,
		setPassword,
		loading,
		errors,
		clearError,
		login,
		resetPassword,
	} = useAuth();

	// Success is handled by UserContext, which swaps the navigator.
	const handleLogin = () => login();

	const handleForgotPassword = () => {
		showPrompt(
			"Reset your password",
			"We'll email you a link to set a new one.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Send link",
					onPress: (resetEmail) => {
						if (resetEmail?.trim())
							resetPassword(resetEmail.trim());
					},
				},
			],
			{ defaultValue: email || "" },
		);
	};

	return (
		<Screen scroll keyboard="avoid" contentContainerStyle={styles.content}>
			<Animated.View
				entering={FadeInDown.duration(400)}
				style={styles.form}
			>
				<Logo width={200} height={110} style={styles.logo} />

				<Text variant="title" align="center" style={styles.heading}>
					Welcome back
				</Text>
				<Text
					variant="body"
					color="textSecondary"
					align="center"
					style={styles.subheading}
				>
					Sign in to see your schedule.
				</Text>

				<Input
					label="Email"
					placeholder="you@example.com"
					icon="mail-outline"
					value={email}
					onChangeText={(v) => {
						setEmail(v);
						clearError("email");
					}}
					error={errors.email}
					keyboardType="email-address"
					autoCapitalize="none"
					autoComplete="email"
					autoCorrect={false}
					returnKeyType="next"
					onSubmitEditing={() => passwordRef.current?.focus()}
					containerStyle={styles.field}
				/>

				<Input
					ref={passwordRef}
					label="Password"
					placeholder="Your password"
					icon="lock-closed-outline"
					password
					value={password}
					onChangeText={(v) => {
						setPassword(v);
						clearError("password");
					}}
					error={errors.password}
					autoComplete="current-password"
					returnKeyType="go"
					onSubmitEditing={handleLogin}
					containerStyle={styles.field}
				/>

				{/* Errors Firebase will not attribute to one field. */}
				{!!errors.form && (
					<View style={styles.formError}>
						<Text variant="caption" color="danger" align="center">
							{errors.form}
						</Text>
					</View>
				)}

				<Button
					title="Sign in"
					onPress={handleLogin}
					loading={loading}
					disabled={!email.trim() || !password}
					size="large"
					fullWidth
					haptic="press"
					style={styles.submit}
				/>

				<Button
					title="Forgot your password?"
					onPress={handleForgotPassword}
					variant="text"
					style={styles.link}
				/>
			</Animated.View>

			<View style={styles.footer}>
				<Text variant="body" color="textSecondary">
					New here?
				</Text>
				<Button
					title="Create an account"
					onPress={() => navigation.navigate("Sign Up")}
					variant="text"
				/>
			</View>
		</Screen>
	);
};

export default LoginPage;

const loginStyles = (theme: Theme) =>
	StyleSheet.create({
		content: {
			flexGrow: 1,
			justifyContent: "center",
			paddingHorizontal: theme.spacing.xl,
			paddingVertical: theme.spacing["2xl"],
		},
		form: {
			width: "100%",
			maxWidth: 420,
			alignSelf: "center",
		},
		logo: {
			alignSelf: "center",
			marginBottom: theme.spacing.xl,
		},
		heading: {
			marginBottom: theme.spacing.xs,
		},
		subheading: {
			marginBottom: theme.spacing.xl,
		},
		field: {
			marginBottom: theme.spacing.lg,
		},
		formError: {
			marginBottom: theme.spacing.md,
		},
		submit: {
			marginTop: theme.spacing.xs,
		},
		link: {
			alignSelf: "center",
			marginTop: theme.spacing.md,
		},
		footer: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			marginTop: theme.spacing.xl,
			gap: theme.spacing.xs,
		},
	});
