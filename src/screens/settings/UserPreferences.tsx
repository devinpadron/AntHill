import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	Alert,
	Platform,
} from "react-native";
import { useUser } from "../../contexts/UserContext";
import {
	getUserPreferences,
	setUserPreferences,
} from "../../services/userService";
import {
	SafeAreaView,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

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

// Calendar filter options (for admin users)
const calendarFilterOptions = [
	{ label: "All Events", value: "all" },
	{ label: "My Events", value: "my" },
];

const UserPreferences = ({ navigation }) => {
	const { userId, isAdmin, companyId } = useUser();
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
			defaultCalendarFilter: isAdmin ? prefFilter : "my",
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

	// Option selector component
	const PreferenceOption = ({ option, selected, onSelect }) => (
		<TouchableOpacity
			style={[styles.optionItem, selected && styles.selectedOption]}
			onPress={() => onSelect(option.value)}
		>
			<Text
				style={[
					styles.optionText,
					selected && styles.selectedOptionText,
				]}
			>
				{option.label}
			</Text>
			{selected && (
				<Icon
					name="check-circle"
					size={24}
					color="#4CAF50"
					style={styles.checkIcon}
				/>
			)}
		</TouchableOpacity>
	);

	if (loading) {
		return (
			<SafeAreaView style={styles.loadingContainer}>
				<ActivityIndicator size="large" color="#0000ff" />
				<Text style={styles.loadingText}>Loading preferences...</Text>
			</SafeAreaView>
		);
	}

	const insets = useSafeAreaInsets();

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.header}>
				<View style={styles.headerRow}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						<Icon name="arrow-back" size={24} color="#333" />
					</TouchableOpacity>
					<View style={styles.headerTextContainer}>
						<Text style={styles.headerTitle}>User Preferences</Text>
						<Text style={styles.headerSubtitle}>
							Customize your application settings
						</Text>
					</View>
				</View>
			</View>

			<ScrollView>
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>
						Preferred Map Application
					</Text>
					<Text style={styles.sectionDescription}>
						Choose which map app to use when navigating to locations
					</Text>
					<View style={styles.optionsContainer}>
						{mapAppOptions.map((option) => (
							<PreferenceOption
								key={option.value}
								option={option}
								selected={prefMap === option.value}
								onSelect={(value) => setPrefMap(value)}
							/>
						))}
					</View>
				</View>

				{isAdmin && (
					<View style={styles.section}>
						<Text style={styles.sectionTitle}>
							Default Calendar Filter
						</Text>
						<Text style={styles.sectionDescription}>
							Set your default calendar view filter
						</Text>
						<View style={styles.optionsContainer}>
							{calendarFilterOptions.map((option) => (
								<PreferenceOption
									key={option.value}
									option={option}
									selected={prefFilter === option.value}
									onSelect={(value) => setPrefFilter(value)}
								/>
							))}
						</View>
					</View>
				)}
			</ScrollView>

			<View style={styles.footer}>
				<TouchableOpacity
					style={styles.saveButton}
					onPress={savePreferences}
					disabled={saving}
				>
					{saving ? (
						<ActivityIndicator size="small" color="#ffffff" />
					) : (
						<Text style={styles.saveButtonText}>
							Save Preferences
						</Text>
					)}
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f5f5",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#f5f5f5",
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: "#666",
	},
	header: {
		padding: 15,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	backButton: {
		padding: 5,
		marginRight: 10,
	},
	headerTextContainer: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333",
	},
	headerSubtitle: {
		fontSize: 16,
		color: "#666",
		marginTop: 5,
	},
	section: {
		backgroundColor: "#fff",
		marginTop: 15,
		padding: 20,
		borderRadius: 8,
		marginHorizontal: 15,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#333",
	},
	sectionDescription: {
		fontSize: 14,
		color: "#666",
		marginTop: 5,
		marginBottom: 15,
	},
	optionsContainer: {
		marginTop: 10,
	},
	optionItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 15,
		borderRadius: 8,
		backgroundColor: "#f9f9f9",
		marginBottom: 10,
		borderWidth: 1,
		borderColor: "#e0e0e0",
	},
	selectedOption: {
		backgroundColor: "#e8f5e9",
		borderColor: "#4CAF50",
	},
	optionText: {
		fontSize: 16,
		color: "#333",
	},
	selectedOptionText: {
		fontWeight: "bold",
		color: "#1B5E20",
	},
	checkIcon: {
		marginLeft: 10,
	},
	footer: {
		padding: 15,
		backgroundColor: "#fff",
		borderTopWidth: 1,
		borderTopColor: "#e0e0e0",
	},
	saveButton: {
		backgroundColor: "#2196F3",
		borderRadius: 8,
		padding: 15,
		alignItems: "center",
		justifyContent: "center",
	},
	saveButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
	},
});

export default UserPreferences;
