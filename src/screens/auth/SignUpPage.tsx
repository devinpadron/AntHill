import React from "react";
import { StyleSheet, ScrollView } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { FormInput } from "../../components/ui/FormInput";
import { Button } from "../../components/ui/Button";
import { Container } from "../../components/ui/Container";
import { useSignUp } from "../../hooks/useSignUp";
import { Spacing } from "../../constants/tokens";

const SignUpPage = ({ navigation }) => {
	const { theme } = useTheme();
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
		<Container variant="page" padding="none" includeSafeArea>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
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

				<FormInput
					placeholder="Company Code:"
					value={accessCode}
					onChangeText={setAccessCode}
				/>

				<Button
					title="Sign Up"
					onPress={handleSignUp}
					loading={isLoading}
					variant="primary"
					style={styles.signUpButton}
				/>
			</ScrollView>
		</Container>
	);
};

export default SignUpPage;

const styles = StyleSheet.create({
	scrollContent: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.xl,
	},
	signUpButton: {
		marginTop: Spacing.xxxl,
		width: "100%",
	},
});
