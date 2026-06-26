import React, { useState } from "react";
import {
	View,
	StatusBar,
	Alert,
	ScrollView,
	TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { Text } from "../../components/ui/Text";
import { Icon } from "../../components/ui/Icon";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { Avatar } from "../../components/ui/Avatar";
import { Divider } from "../../components/ui/Divider";
import { useTheme } from "../../contexts/ThemeContext";
import { Rust } from "../../constants/colors";

const Settings = ({ navigation }: any) => {
	const { theme, mode } = useTheme();
	const { logout } = useUser();
	const { companyData, isLoading } = useCompany();

	const handleLogout = () => {
		Alert.alert("Log out", "Are you sure you want to log out?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Log out",
				style: "destructive",
				onPress: async () => {
					try {
						await logout();
					} catch (error) {
						console.error("Signout Error", error);
					}
				},
			},
		]);
	};

	if (isLoading) {
		return (
			<SafeAreaView
				style={{ flex: 1, backgroundColor: theme.Background }}
			/>
		);
	}

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: theme.Background }}
			edges={["top"]}
		>
			<StatusBar
				barStyle={mode === "dark" ? "light-content" : "dark-content"}
			/>

			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: 20,
					paddingTop: 12,
					paddingBottom: 40,
				}}
				showsVerticalScrollIndicator={false}
			>
				<Text variant="display" style={{ marginBottom: 16 }}>
					Settings
				</Text>

				{/* Active company */}
				<Card padding="md">
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 14,
						}}
					>
						<Avatar
							name={companyData?.name || "Company"}
							size="md"
							fallbackIcon="business"
						/>
						<View style={{ flex: 1 }}>
							<Text
								variant="eyebrow"
								color="tertiary"
								style={{ fontSize: 11, marginBottom: 2 }}
							>
								Active company
							</Text>
							<Text variant="h3" weight="semibold">
								{companyData?.name || "—"}
							</Text>
						</View>
						<Pill tone="neutral">Employee</Pill>
					</View>
				</Card>

				{/* Account */}
				<SectionLabel>Account</SectionLabel>
				<Card padding="none">
					<NavRow
						title="Profile"
						onPress={() => navigation.push("Profile")}
					/>
					<Divider soft inset={16} />
					<NavRow
						title="Preferences"
						onPress={() => navigation.push("UserPreferences")}
					/>
				</Card>

				{/* Actions */}
				<SectionLabel>Account actions</SectionLabel>
				<Card padding="none">
					<TouchableOpacity
						onPress={handleLogout}
						activeOpacity={0.7}
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							paddingHorizontal: 16,
							paddingVertical: 16,
						}}
					>
						<Text
							variant="body"
							weight="medium"
							style={{ color: Rust[500] }}
						>
							Log out
						</Text>
					</TouchableOpacity>
				</Card>
			</ScrollView>
		</SafeAreaView>
	);
};

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<Text
			variant="eyebrow"
			color="tertiary"
			style={{
				fontSize: 11,
				marginTop: 24,
				marginBottom: 10,
				marginLeft: 4,
			}}
		>
			{children}
		</Text>
	);
}

function NavRow({
	title,
	onPress,
	nested = false,
	expanded,
}: {
	title: string;
	onPress: () => void;
	nested?: boolean;
	expanded?: boolean;
}) {
	const { theme } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.7}
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				paddingHorizontal: 16,
				paddingLeft: nested ? 28 : 16,
				paddingVertical: 15,
			}}
		>
			<Text
				variant="body"
				weight={nested ? "normal" : "medium"}
				color={nested ? "secondary" : "primary"}
			>
				{title}
			</Text>
			<View
				style={
					expanded ? { transform: [{ rotate: "180deg" }] } : undefined
				}
			>
				<Icon
					name={expanded === undefined ? "chev" : "chevD"}
					size={18}
					color={theme.TertiaryText}
				/>
			</View>
		</TouchableOpacity>
	);
}

export default Settings;
