import React, { useState, useEffect } from "react";
import {
	View,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	Alert,
	Platform,
	StatusBar,
} from "react-native";
import { useUser } from "../../contexts/UserContext";
import {
	getUserPreferences,
	setUserPreferences,
} from "../../services/userService";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "../../components/ui/Text";
import { Icon } from "../../components/ui/Icon";
import { Card } from "../../components/ui/Card";
import { Divider } from "../../components/ui/Divider";
import { useTheme } from "../../contexts/ThemeContext";
import { Cream, Olive } from "../../constants/colors";

// Map app options
const mapAppOptions =
	Platform.OS === "ios"
		? [
				{ label: "Apple Maps", value: "apple" },
				{ label: "Google Maps", value: "google" },
				{ label: "Waze", value: "waze" },
			]
		: [
				{ label: "Google Maps", value: "google" },
				{ label: "Waze", value: "waze" },
			];

// Calendar filter options (admin-only; removed from mobile once the web
// console covers admin calendar views).
const calendarFilterOptions = [
	{ label: "All events", value: "all" },
	{ label: "My events", value: "my" },
];

const UserPreferences = ({ navigation }) => {
	const { theme, mode } = useTheme();
	const { userId } = useUser();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [prefMap, setPrefMap] = useState(
		Platform.OS === "ios" ? "apple" : "google",
	);
	const [prefFilter, setPrefFilter] = useState("all");

	// Fetch user preferences on component mount
	useEffect(() => {
		const fetchUserPreferences = async () => {
			try {
				setLoading(true);
				const preferencesDoc = await getUserPreferences(userId);

				if (preferencesDoc) {
					const data = preferencesDoc;
					if (data) {
						setPrefMap(data.preferredMapApp);
						setPrefFilter(data.defaultCalendarFilter);
					}
				}
			} catch (error) {
				console.error("Error fetching preferences:", error);
				Alert.alert("Error", "Failed to load your preferences");
			} finally {
				setLoading(false);
			}
		};

		if (userId) {
			fetchUserPreferences();
		}
	}, [userId]);

	// Save preferences to Firestore
	const savePreferences = async () => {
		const preferences = {
			preferredMapApp: prefMap,
			defaultCalendarFilter: "my",
		};
		try {
			setSaving(true);
			await setUserPreferences(userId, preferences);

			Alert.alert("Success", "Your preferences have been saved");
		} catch (error) {
			console.error("Error saving preferences:", error);
			Alert.alert("Error", "Failed to save your preferences");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<SafeAreaView
				style={{
					flex: 1,
					backgroundColor: theme.Background,
					alignItems: "center",
					justifyContent: "center",
					gap: 12,
				}}
			>
				<ActivityIndicator size="large" color={theme.Accent} />
				<Text variant="caption" color="secondary">
					Loading preferences…
				</Text>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: theme.Background }}
			edges={["top", "bottom"]}
		>
			<StatusBar
				barStyle={mode === "dark" ? "light-content" : "dark-content"}
			/>

			{/* Header */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 12,
					paddingHorizontal: 20,
					paddingTop: 8,
					paddingBottom: 12,
				}}
			>
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					hitSlop={8}
					style={{
						width: 38,
						height: 38,
						borderRadius: 12,
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: theme.Surface,
						borderWidth: 0.5,
						borderColor: theme.BorderColor,
					}}
				>
					<Icon name="chevL" size={18} color={theme.PrimaryText} />
				</TouchableOpacity>
				<View style={{ flex: 1 }}>
					<Text variant="h2" weight="semibold">
						Preferences
					</Text>
					<Text variant="caption" color="tertiary">
						Customize your app settings
					</Text>
				</View>
			</View>

			<ScrollView
				contentContainerStyle={{
					paddingHorizontal: 20,
					paddingTop: 8,
					paddingBottom: 32,
				}}
				showsVerticalScrollIndicator={false}
			>
				<SectionLabel>Preferred map app</SectionLabel>
				<Text
					variant="caption"
					color="secondary"
					style={{ marginBottom: 10, marginLeft: 4 }}
				>
					Used when navigating to event locations.
				</Text>
				<SelectGroup
					options={mapAppOptions}
					selected={prefMap}
					onSelect={setPrefMap}
				/>
			</ScrollView>

			{/* Footer */}
			<View
				style={{
					paddingHorizontal: 20,
					paddingTop: 12,
					paddingBottom: 8,
				}}
			>
				<TouchableOpacity
					onPress={savePreferences}
					disabled={saving}
					activeOpacity={0.9}
					style={{
						height: 56,
						borderRadius: 18,
						backgroundColor: Olive[600],
						alignItems: "center",
						justifyContent: "center",
						opacity: saving ? 0.7 : 1,
						shadowColor: Olive[600],
						shadowOffset: { width: 0, height: 8 },
						shadowOpacity: 0.18,
						shadowRadius: 20,
						elevation: 6,
					}}
				>
					{saving ? (
						<ActivityIndicator color={Cream[50]} />
					) : (
						<Text style={{ color: Cream[50] }} weight="bold">
							Save preferences
						</Text>
					)}
				</TouchableOpacity>
			</View>
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
				marginBottom: 6,
				marginLeft: 4,
			}}
		>
			{children}
		</Text>
	);
}

function SelectGroup({
	options,
	selected,
	onSelect,
}: {
	options: { label: string; value: string }[];
	selected: string;
	onSelect: (value: string) => void;
}) {
	const { theme } = useTheme();
	return (
		<Card padding="none">
			{options.map((option, index) => {
				const isSelected = selected === option.value;
				return (
					<View key={option.value}>
						{index > 0 && <Divider soft inset={16} />}
						<TouchableOpacity
							onPress={() => onSelect(option.value)}
							activeOpacity={0.7}
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								paddingHorizontal: 16,
								paddingVertical: 16,
								backgroundColor: isSelected
									? theme.AccentSoft
									: "transparent",
							}}
						>
							<Text
								variant="body"
								color={isSelected ? "accent" : "primary"}
								weight={isSelected ? "semibold" : "normal"}
							>
								{option.label}
							</Text>
							{isSelected && (
								<Icon
									name="check"
									size={20}
									color={theme.AccentStrong}
								/>
							)}
						</TouchableOpacity>
					</View>
				);
			})}
		</Card>
	);
}

export default UserPreferences;
