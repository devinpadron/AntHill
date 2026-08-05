import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormInput } from "../../components/ui/FormInput";
import { Button } from "../../components/ui/Button";
import { useSignUp } from "../../hooks/useSignUp";
import { AntHill } from "../../constants/colors";

/*
 * Signup.
 *
 * One code field, two kinds of code: a company access code joins the company
 * ungrouped, a group join code also drops the new hire straight into that
 * group with the visibility its manager chose. The screen does not need to
 * know which — resolveJoinCode works it out.
 */
const SignUpPage = ({ navigation }) => {
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
		handleSignUp,
	} = useSignUp(navigation);

	return (
		<SafeAreaView style={styles.container}>
			<FormInput
				placeholder="First Name:"
				value={firstName}
				onChangeText={setFirstName}
			/>

			<FormInput
				placeholder="Last Name:"
				value={lastName}
				onChangeText={setLastName}
			/>

			<FormInput
				placeholder="Email:"
				value={email}
				onChangeText={setEmail}
				keyboardType="email-address"
			/>

			<FormInput
				placeholder="Password:"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>

			<FormInput
				placeholder="Confirm Password:"
				value={confPassword}
				onChangeText={setConfPassword}
				secureTextEntry
			/>

			{/*
			 * NOT autoCapitalize="characters". Group codes are generated from
			 * an uppercase alphabet and lookupJoinCode uppercases whatever is
			 * typed, so they match either way — but a COMPANY access code is
			 * matched exactly, and real ones are mixed case ("CaseCreativeCo",
			 * "SoBridal!"). Forcing caps made every one of those fail as an
			 * invalid code.
			 */}
			<FormInput
				placeholder="Company or Group Code:"
				value={accessCode}
				onChangeText={setAccessCode}
			/>

			<Button
				title="Sign Up"
				onPress={handleSignUp}
				loading={isLoading}
				style={styles.signUpButton}
				textStyle={styles.buttonText}
				variant="primary"
				fullWidth
			/>
		</SafeAreaView>
	);
};

export default SignUpPage;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "center",
		//justifyContent: "center",
		paddingHorizontal: 20,
		backgroundColor: "white",
	},
	signUpButton: {
		height: 48,
		marginTop: 20,
		borderRadius: 8,
		width: "100%",
		backgroundColor: AntHill.Black,
	},
	buttonText: {
		fontSize: 18,
		fontWeight: "600",
		color: AntHill.White,
	},
	backButton: {
		backgroundColor: "transparent",
		marginTop: 16,
	},
	backButtonText: {
		fontSize: 16,
		color: AntHill.Black,
		textDecorationLine: "underline",
	},
});
