import React, { useState } from "react";
import {
	View,
	TextInput,
	TouchableOpacity,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/auth/useAuth";
import { showPrompt } from "../../utils/alertUtils";
import { useTheme } from "../../contexts/ThemeContext";

import { Text } from "../../components/ui/Text";
import { Icon } from "../../components/ui/Icon";
import { AntGlyph } from "../../components/ui/brand/AntGlyph";
import { Cream, Ink, Olive } from "../../constants/colors";
import { FontFamily } from "../../constants/tokens";

const LoginPage = ({ navigation }: { navigation: any }) => {
	const { theme } = useTheme();
	const {
		email,
		setEmail,
		password,
		setPassword,
		loading,
		login,
		resetPassword,
	} = useAuth();
	const [showPassword, setShowPassword] = useState(false);

	const handleLogin = async () => {
		await login();
	};

	const handleForgotPassword = () => {
		const defaultEmail = email || "";
		showPrompt(
			"Forgot password",
			"Please enter your account email.",
			[
				{ text: "Cancel", onPress: () => {}, style: "cancel" },
				{
					text: "Submit",
					onPress: (resetEmail: string) => {
						if (resetEmail && resetEmail.trim()) {
							resetPassword(resetEmail.trim());
						}
					},
				},
			],
			{ defaultValue: defaultEmail },
		);
	};

	return (
		<View style={{ flex: 1, backgroundColor: Cream[100] }}>
			{/* Ant watermarks */}
			<View
				pointerEvents="none"
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: 0,
					bottom: 0,
				}}
			>
				<View
					style={{
						position: "absolute",
						top: 90,
						left: -30,
						opacity: 0.05,
					}}
				>
					<AntGlyph size={260} color={Ink[900]} />
				</View>
				<View
					style={{
						position: "absolute",
						bottom: 120,
						right: -10,
						opacity: 0.04,
						transform: [{ rotate: "-20deg" }],
					}}
				>
					<AntGlyph size={180} color={Ink[900]} />
				</View>
			</View>

			<SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === "ios" ? "padding" : undefined}
				>
					<ScrollView
						contentContainerStyle={{ flexGrow: 1 }}
						keyboardShouldPersistTaps="handled"
					>
						{/* Top — logo + welcome */}
						<View style={{ paddingHorizontal: 32, paddingTop: 40 }}>
							<View
								style={{
									width: 56,
									height: 56,
									borderRadius: 18,
									backgroundColor: Ink[900],
									alignItems: "center",
									justifyContent: "center",
									shadowColor: Ink[900],
									shadowOffset: { width: 0, height: 8 },
									shadowOpacity: 0.18,
									shadowRadius: 20,
									elevation: 8,
								}}
							>
								<AntGlyph size={30} color={Cream[50]} />
							</View>

							<View style={{ marginTop: 28 }}>
								<Text
									variant="displayLg"
									style={{
										fontFamily: FontFamily.display,
										fontSize: 44,
										lineHeight: 45,
									}}
								>
									Welcome back,
								</Text>
								<Text
									variant="displayLg"
									color="accent"
									italic
									style={{ fontSize: 44, lineHeight: 45 }}
								>
									let's get to work.
								</Text>
							</View>

							<Text
								variant="caption"
								color="secondary"
								style={{ marginTop: 10, lineHeight: 22 }}
							>
								Sign in to see today's shift, clock in, and
								check off your tasks.
							</Text>
						</View>

						<View style={{ flex: 1 }} />

						{/* Form */}
						<View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
							<Field
								label="EMAIL"
								value={email}
								onChangeText={setEmail}
								autoCapitalize="none"
								keyboardType="email-address"
								autoComplete="email"
								placeholder="you@company.com"
							/>
							<View style={{ height: 12 }} />
							<Field
								label="PASSWORD"
								value={password}
								onChangeText={setPassword}
								password={!showPassword}
								trailing={showPassword ? "Hide" : "Show"}
								onPressTrailing={() =>
									setShowPassword((v) => !v)
								}
								placeholder="••••••••"
							/>
							<TouchableOpacity
								onPress={handleForgotPassword}
								hitSlop={8}
								style={{ marginTop: 10, alignSelf: "flex-end" }}
							>
								<Text
									variant="caption"
									color="secondary"
									weight="medium"
								>
									Forgot password?
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								disabled={loading}
								onPress={handleLogin}
								activeOpacity={0.9}
								style={{
									marginTop: 18,
									height: 56,
									borderRadius: 18,
									backgroundColor: Ink[900],
									alignItems: "center",
									justifyContent: "center",
									flexDirection: "row",
									gap: 10,
									opacity: loading ? 0.7 : 1,
									shadowColor: Ink[900],
									shadowOffset: { width: 0, height: 8 },
									shadowOpacity: 0.18,
									shadowRadius: 20,
									elevation: 6,
								}}
							>
								{loading ? (
									<ActivityIndicator color={Cream[50]} />
								) : (
									<>
										<Text
											style={{
												color: Cream[50],
												fontFamily: FontFamily.ui,
												fontWeight: "700",
												fontSize: 16,
												letterSpacing: -0.1,
											}}
										>
											Sign in
										</Text>
										<Icon
											name="chev"
											size={16}
											color={Cream[50]}
										/>
									</>
								)}
							</TouchableOpacity>

							<View
								style={{
									alignItems: "center",
									marginTop: 14,
								}}
							>
								<Text variant="caption" color="secondary">
									New to anthill?{" "}
									<Text
										variant="caption"
										color="accent"
										weight="semibold"
										onPress={() =>
											navigation.navigate("Sign Up")
										}
									>
										Use access code
									</Text>
								</Text>
							</View>
							<View style={{ height: 32 }} />
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</View>
	);
};

interface FieldProps {
	label: string;
	value: string;
	onChangeText: (s: string) => void;
	password?: boolean;
	trailing?: string;
	onPressTrailing?: () => void;
	placeholder?: string;
	autoCapitalize?: "none" | "sentences" | "words" | "characters";
	keyboardType?: "default" | "email-address";
	autoComplete?: "email" | "password";
}

function Field({
	label,
	value,
	onChangeText,
	password,
	trailing,
	onPressTrailing,
	placeholder,
	autoCapitalize,
	keyboardType,
	autoComplete,
}: FieldProps) {
	const { theme } = useTheme();
	return (
		<View>
			<Text
				variant="eyebrow"
				color="tertiary"
				style={{ marginBottom: 6, marginLeft: 4, fontSize: 11 }}
			>
				{label}
			</Text>
			<View
				style={{
					backgroundColor: theme.Surface,
					borderWidth: 0.5,
					borderColor: theme.BorderColor,
					borderRadius: 16,
					paddingHorizontal: 16,
					height: 54,
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
				}}
			>
				<TextInput
					value={value}
					onChangeText={onChangeText}
					secureTextEntry={password}
					placeholder={placeholder}
					placeholderTextColor={theme.TertiaryText}
					autoCapitalize={autoCapitalize}
					keyboardType={keyboardType}
					autoComplete={autoComplete}
					style={{
						flex: 1,
						fontFamily: FontFamily.ui,
						fontSize: 15.5,
						color: theme.PrimaryText,
					}}
				/>
				{trailing && (
					<TouchableOpacity onPress={onPressTrailing} hitSlop={8}>
						<Text
							variant="small"
							color="accent"
							weight="semibold"
							style={{ fontSize: 12 }}
						>
							{trailing}
						</Text>
					</TouchableOpacity>
				)}
			</View>
		</View>
	);
}

export default LoginPage;
