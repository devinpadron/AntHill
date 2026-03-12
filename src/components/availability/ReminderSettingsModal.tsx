import React from "react";
import {
	View,
	Modal,
	TouchableOpacity,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	Switch,
	StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { FormInput } from "../ui/FormInput";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius } from "../../constants/tokens";

interface ReminderSettingsModalProps {
	visible: boolean;
	onClose: () => void;
	onSave: () => void;
	reminderHours: string;
	setReminderHours: (value: string) => void;
	reminderMinutes: string;
	setReminderMinutes: (value: string) => void;
	remindersEnabled: boolean;
	setRemindersEnabled: (value: boolean) => void;
}

export const ReminderSettingsModal: React.FC<ReminderSettingsModalProps> = ({
	visible,
	onClose,
	onSave,
	reminderHours,
	setReminderHours,
	reminderMinutes,
	setReminderMinutes,
	remindersEnabled,
	setRemindersEnabled,
}) => {
	const { theme } = useTheme();

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				style={styles.overlay}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				<View
					style={[
						styles.content,
						{ backgroundColor: theme.CardBackground },
					]}
				>
					{/* Header */}
					<View
						style={[
							styles.header,
							{ borderBottomColor: theme.BorderColor },
						]}
					>
						<Text variant="h3" weight="bold" color="primary">
							Set Availability Reminder
						</Text>
						<TouchableOpacity
							onPress={onClose}
							style={styles.closeButton}
						>
							<Ionicons
								name="close"
								size={24}
								color={theme.SecondaryText}
							/>
						</TouchableOpacity>
					</View>

					{/* Body */}
					<ScrollView style={styles.body}>
						<Text
							variant="caption"
							color="secondary"
							style={styles.description}
						>
							Configure when and how often workers should be
							reminded to confirm their availability.
						</Text>

						{/* Toggle Switch for Reminders */}
						<View
							style={[
								styles.toggleContainer,
								{ backgroundColor: theme.Background },
							]}
						>
							<View style={styles.toggleLabelContainer}>
								<Text
									variant="body"
									weight="semibold"
									color="primary"
								>
									Enable Reminders
								</Text>
								<Text variant="small" color="secondary">
									Send automatic reminders to workers
								</Text>
							</View>
							<Switch
								value={remindersEnabled}
								onValueChange={setRemindersEnabled}
								trackColor={{
									false: theme.DateBadge,
									true: theme.LocationBlue,
								}}
								thumbColor={
									remindersEnabled
										? theme.LocationBlue
										: theme.DateBadge
								}
								ios_backgroundColor={theme.DateBadge}
							/>
						</View>

						{/* Time inputs - only show when reminders are enabled */}
						{remindersEnabled && (
							<>
								<Text
									variant="caption"
									weight="semibold"
									color="primary"
									style={styles.sectionLabel}
								>
									Reminder Frequency
								</Text>
								<View style={styles.timeInputContainer}>
									<View style={styles.inputGroup}>
										<Text
											variant="small"
											weight="semibold"
											color="secondary"
											style={styles.inputLabel}
										>
											Hours
										</Text>
										<FormInput
											placeholder="24"
											value={reminderHours}
											onChangeText={setReminderHours}
											keyboardType="numeric"
											style={styles.timeInput}
										/>
									</View>

									<Text
										variant="h2"
										weight="bold"
										color="secondary"
										style={styles.timeSeparator}
									>
										:
									</Text>

									<View style={styles.inputGroup}>
										<Text
											variant="small"
											weight="semibold"
											color="secondary"
											style={styles.inputLabel}
										>
											Minutes
										</Text>
										<FormInput
											placeholder="0"
											value={reminderMinutes}
											onChangeText={setReminderMinutes}
											keyboardType="numeric"
											style={styles.timeInput}
										/>
									</View>
								</View>

								<Text
									variant="small"
									color="secondary"
									align="center"
									style={[
										styles.previewText,
										{ backgroundColor: theme.DateBadge },
									]}
								>
									Workers will be reminded every{" "}
									{reminderHours || "24"} hours and{" "}
									{reminderMinutes || "0"} minutes until they
									confirm or decline their event.
								</Text>
							</>
						)}

						{/* Disabled state message */}
						{!remindersEnabled && (
							<Text
								variant="caption"
								color="secondary"
								align="center"
								style={styles.disabledText}
							>
								Reminders are disabled. Workers will not receive
								automatic notifications to confirm their
								availability.
							</Text>
						)}
					</ScrollView>

					{/* Footer */}
					<View
						style={[
							styles.footer,
							{ borderTopColor: theme.BorderColor },
						]}
					>
						<Button
							variant="secondary"
							title="Cancel"
							onPress={onClose}
							style={styles.footerButton}
						/>
						<Button
							variant="primary"
							title="Save Settings"
							onPress={onSave}
							style={styles.footerButton}
						/>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		borderRadius: BorderRadius.xl,
		width: "90%",
		maxHeight: "80%",
		overflow: "hidden",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.xl,
		borderBottomWidth: 1,
	},
	closeButton: {
		padding: 4,
	},
	body: {
		padding: Spacing.xl,
	},
	description: {
		marginBottom: Spacing.xl,
		lineHeight: 20,
	},
	toggleContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: Spacing.lg,
		paddingHorizontal: Spacing.lg,
		borderRadius: BorderRadius.lg,
		marginBottom: Spacing.xxl,
	},
	toggleLabelContainer: {
		flex: 1,
		marginRight: Spacing.lg,
	},
	sectionLabel: {
		marginBottom: Spacing.md,
	},
	timeInputContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		marginBottom: Spacing.xl,
	},
	inputGroup: {
		alignItems: "center",
	},
	inputLabel: {
		marginBottom: Spacing.sm,
	},
	timeInput: {
		width: 80,
		textAlign: "center",
	},
	timeSeparator: {
		marginHorizontal: Spacing.lg,
	},
	previewText: {
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
	},
	disabledText: {
		backgroundColor: "#FEF3C7",
		padding: Spacing.lg,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: "#F59E0B",
		marginTop: Spacing.lg,
	},
	footer: {
		flexDirection: "row",
		padding: Spacing.xl,
		borderTopWidth: 1,
	},
	footerButton: {
		flex: 1,
		marginHorizontal: 4,
	},
});
