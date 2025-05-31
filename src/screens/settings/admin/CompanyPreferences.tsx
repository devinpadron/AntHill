import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Switch,
	SafeAreaView,
	ScrollView,
	Alert,
	ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../../../contexts/UserContext";
import { useCompany } from "../../../contexts/CompanyContext";
import * as Clipboard from "expo-clipboard";

const CompanyPreferences = ({ navigation }) => {
	const { user } = useUser();
	const { companyData, preferences, isLoading, updatePreferences } =
		useCompany();
	const [copySuccess, setCopySuccess] = useState(false);

	const inviteCode = companyData?.accessCode || "";
	const companyName = companyData?.name || "";

	const handleCopyInviteCode = async () => {
		await Clipboard.setStringAsync(inviteCode);
		setCopySuccess(true);
		setTimeout(() => setCopySuccess(false), 2000);
	};

	const handleWorkWeekChange = (value) => {
		updatePreferences({
			...preferences,
			workWeekStarts: value,
		});
	};

	const handleToggleChange = (setting, value) => {
		updatePreferences({
			...preferences,
			[setting]: value,
		});
	};

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons name="chevron-back" size={24} color="#000" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Company Preferences</Text>
			</View>

			<ScrollView style={styles.content}>
				<View style={styles.companyInfoSection}>
					<Text style={styles.companyName}>{companyName}</Text>

					<View style={styles.inviteCodeContainer}>
						<Text style={styles.label}>Invite Code:</Text>
						<TouchableOpacity
							style={styles.inviteCodeButton}
							onPress={handleCopyInviteCode}
						>
							<Text style={styles.inviteCode}>{inviteCode}</Text>
							<Ionicons
								name={
									copySuccess ? "checkmark" : "copy-outline"
								}
								size={20}
								color={copySuccess ? "#4CAF50" : "#007AFF"}
							/>
						</TouchableOpacity>
					</View>
				</View>

				<View style={styles.divider} />

				<View style={styles.settingsSection}>
					<Text style={styles.sectionTitle}>Payroll Settings</Text>

					<View style={styles.settingItem}>
						<Text style={styles.settingLabel}>
							Work Week Starts On
						</Text>
						<View style={styles.radioGroup}>
							<TouchableOpacity
								style={[
									styles.radioButton,
									preferences.workWeekStarts === "sunday" &&
										styles.radioButtonSelected,
								]}
								onPress={() => handleWorkWeekChange("sunday")}
							>
								<Text
									style={[
										styles.radioText,
										preferences.workWeekStarts ===
											"sunday" &&
											styles.radioTextSelected,
									]}
								>
									Sunday
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={[
									styles.radioButton,
									preferences.workWeekStarts === "monday" &&
										styles.radioButtonSelected,
								]}
								onPress={() => handleWorkWeekChange("monday")}
							>
								<Text
									style={[
										styles.radioText,
										preferences.workWeekStarts ===
											"monday" &&
											styles.radioTextSelected,
									]}
								>
									Monday
								</Text>
							</TouchableOpacity>
						</View>
					</View>

					<View style={styles.divider} />

					<Text style={styles.sectionTitle}>User Permissions</Text>

					<View style={styles.settingItem}>
						<Text style={styles.settingLabel}>
							Employee's Can Submit Edits
						</Text>
						<Switch
							value={preferences.allowUserEventEditing}
							onValueChange={(value) =>
								handleToggleChange(
									"allowUserEventEditing",
									value,
								)
							}
							trackColor={{ false: "#d3d3d3", true: "#b3e0ff" }}
							thumbColor={
								preferences.allowUserEventEditing
									? "#007AFF"
									: "#f4f3f4"
							}
						/>
					</View>

					<View style={styles.settingItem}>
						<Text style={styles.settingLabel}>
							Enable Clock-In Tab
						</Text>
						<Switch
							value={preferences.enableTimeSheet}
							onValueChange={(value) =>
								handleToggleChange("enableTimeSheet", value)
							}
							trackColor={{ false: "#d3d3d3", true: "#b3e0ff" }}
							thumbColor={
								preferences.enableTimeSheet
									? "#007AFF"
									: "#f4f3f4"
							}
						/>
					</View>

					<View style={styles.settingItem}>
						<Text style={styles.settingLabel}>
							Allow Users to View Event Labels
						</Text>
						<Switch
							value={preferences.canViewEventLabels}
							onValueChange={(value) =>
								handleToggleChange("canViewEventLabels", value)
							}
							trackColor={{ false: "#d3d3d3", true: "#b3e0ff" }}
							thumbColor={
								preferences.canViewEventLabels
									? "#007AFF"
									: "#f4f3f4"
							}
						/>
					</View>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#fff",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	backButton: {
		marginRight: 10,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "bold",
		flex: 1,
		textAlign: "center",
		marginRight: 34,
	},
	content: {
		flex: 1,
		padding: 16,
	},
	companyInfoSection: {
		marginBottom: 20,
	},
	companyName: {
		fontSize: 22,
		fontWeight: "bold",
		marginBottom: 12,
	},
	inviteCodeContainer: {
		marginTop: 8,
	},
	label: {
		fontSize: 14,
		color: "#666",
		marginBottom: 4,
	},
	inviteCodeButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		backgroundColor: "#f5f5f5",
		padding: 12,
		borderRadius: 8,
		marginTop: 4,
	},
	inviteCode: {
		fontSize: 16,
		fontFamily: "monospace",
		letterSpacing: 1,
	},
	divider: {
		height: 1,
		backgroundColor: "#e0e0e0",
		marginVertical: 16,
	},
	settingsSection: {
		marginBottom: 20,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: 16,
	},
	settingItem: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 12,
	},
	settingLabel: {
		fontSize: 16,
		flex: 1,
		marginRight: 16,
	},
	radioGroup: {
		flexDirection: "row",
		gap: 10,
	},
	radioButton: {
		paddingVertical: 8,
		paddingHorizontal: 16,
		borderRadius: 20,
		backgroundColor: "#f0f0f0",
	},
	radioButtonSelected: {
		backgroundColor: "#007AFF",
	},
	radioText: {
		color: "#333",
		fontWeight: "500",
	},
	radioTextSelected: {
		color: "#fff",
	},
});

export default CompanyPreferences;
