import React, { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import {
	Button,
	Input,
	Screen,
	ScreenFooter,
	ScreenHeader,
	Text,
} from "../../components/ui";
import { useSignUp } from "../../hooks/useSignUp";
import { Theme, useThemedStyles } from "../../theme";

/*
 * Signup.
 *
 * One code field, two kinds of code: a company access code joins the company
 * ungrouped, a group join code also drops the new hire straight into that
 * group with the visibility its manager chose. The screen does not need to
 * know which — resolveJoinCode works it out.
 *
 * The form is grouped rather than presented as six identical boxes, and the
 * submit button lives in a sticky footer so it stays reachable with the
 * keyboard open — this is the longest form in the app.
 */
const SignUpPage = ({ navigation }) => {
	const styles = useThemedStyles(signUpStyles);

	const lastNameRef = useRef<TextInput>(null);
	const emailRef = useRef<TextInput>(null);
	const passwordRef = useRef<TextInput>(null);
	const confPasswordRef = useRef<TextInput>(null);
	const codeRef = useRef<TextInput>(null);

	const {
		firstName,
		setFirstName,
		lastName,
		setLastName,
		email,
		setEmail,
		password,
		setPassword,
		confPassword,
		setConfPassword,
		accessCode,
		setAccessCode,
		isLoading,
		errors,
		clearError,
		handleSignUp,
	} = useSignUp(navigation);

	return (
		<Screen
			scroll
			keyboard="aware"
			padded
			header={
				<ScreenHeader
					title="Create your account"
					onBack={() => navigation.goBack()}
				/>
			}
			footer={
				<ScreenFooter safeArea>
					{!!errors.form && (
						<Text
							variant="caption"
							color="danger"
							align="center"
							style={styles.formError}
						>
							{errors.form}
						</Text>
					)}
					<Button
						title="Create account"
						onPress={handleSignUp}
						loading={isLoading}
						size="large"
						fullWidth
						haptic="press"
					/>
				</ScreenFooter>
			}
		>
			<Text
				variant="overline"
				color="textSecondary"
				uppercase
				style={styles.sectionFirst}
			>
				Your details
			</Text>

			<View style={styles.nameRow}>
				<Input
					label="First name"
					placeholder="Alex"
					value={firstName}
					onChangeText={(v) => {
						setFirstName(v);
						clearError("firstName");
					}}
					error={errors.firstName}
					autoCapitalize="words"
					autoComplete="given-name"
					returnKeyType="next"
					onSubmitEditing={() => lastNameRef.current?.focus()}
					containerStyle={styles.nameField}
				/>
				<Input
					ref={lastNameRef}
					label="Last name"
					placeholder="Rivera"
					value={lastName}
					onChangeText={(v) => {
						setLastName(v);
						clearError("lastName");
					}}
					error={errors.lastName}
					autoCapitalize="words"
					autoComplete="family-name"
					returnKeyType="next"
					onSubmitEditing={() => emailRef.current?.focus()}
					containerStyle={styles.nameField}
				/>
			</View>

			<Input
				ref={emailRef}
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

			<Text
				variant="overline"
				color="textSecondary"
				uppercase
				style={styles.section}
			>
				Password
			</Text>

			<Input
				ref={passwordRef}
				label="Password"
				placeholder="Choose a password"
				icon="lock-closed-outline"
				password
				value={password}
				onChangeText={(v) => {
					setPassword(v);
					clearError("password");
				}}
				error={errors.password}
				helper="At least 8 characters, with an uppercase and a lowercase letter, a number and a symbol."
				autoComplete="new-password"
				returnKeyType="next"
				onSubmitEditing={() => confPasswordRef.current?.focus()}
				containerStyle={styles.field}
			/>

			<Input
				ref={confPasswordRef}
				label="Confirm password"
				placeholder="Type it again"
				icon="lock-closed-outline"
				password
				value={confPassword}
				onChangeText={(v) => {
					setConfPassword(v);
					clearError("confPassword");
				}}
				error={errors.confPassword}
				autoComplete="new-password"
				returnKeyType="next"
				onSubmitEditing={() => codeRef.current?.focus()}
				containerStyle={styles.field}
			/>

			<Text
				variant="overline"
				color="textSecondary"
				uppercase
				style={styles.section}
			>
				Join your company
			</Text>

			{/*
			 * NOT autoCapitalize="characters". Group codes are generated from
			 * an uppercase alphabet and lookupJoinCode uppercases whatever is
			 * typed, so they match either way — but a COMPANY access code is
			 * matched exactly, and real ones are mixed case ("CaseCreativeCo",
			 * "SoBridal!"). Forcing caps made every one of those fail as an
			 * invalid code.
			 */}
			<Input
				ref={codeRef}
				label="Company or group code"
				placeholder="Given to you by your manager"
				icon="key-outline"
				value={accessCode}
				onChangeText={(v) => {
					setAccessCode(v);
					clearError("accessCode");
				}}
				error={errors.accessCode}
				helper={
					errors.accessCode ? undefined : "Codes are case sensitive."
				}
				autoCapitalize="none"
				autoCorrect={false}
				returnKeyType="go"
				onSubmitEditing={handleSignUp}
				containerStyle={styles.field}
			/>
		</Screen>
	);
};

export default SignUpPage;

const signUpStyles = (theme: Theme) =>
	StyleSheet.create({
		sectionFirst: {
			marginTop: theme.spacing.lg,
			marginBottom: theme.spacing.md,
		},
		section: {
			marginTop: theme.spacing.xl,
			marginBottom: theme.spacing.md,
		},
		nameRow: {
			flexDirection: "row",
			gap: theme.spacing.md,
		},
		nameField: {
			flex: 1,
		},
		field: {
			marginTop: theme.spacing.lg,
		},
		formError: {
			marginBottom: theme.spacing.md,
		},
	});
