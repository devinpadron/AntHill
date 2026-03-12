import React from "react";
import {
	View,
	Modal,
	TouchableOpacity,
	ScrollView,
	KeyboardAvoidingView,
	Platform,
	StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { LoadingScreen } from "../ui/LoadingScreen";
import { WorkerSection } from "./WorkerSection";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, BorderRadius } from "../../constants/tokens";
import { Clock } from "../../constants/colors";

interface EventInfo {
	id: string;
	title: string;
	date: string;
	location: string;
}

interface Worker {
	id: string;
	firstName: string;
	lastName: string;
}

interface WorkerDetails {
	confirmed: Worker[];
	unconfirmed: Worker[];
	declined: Worker[];
}

interface AdminWorkerModalProps {
	visible: boolean;
	onClose: () => void;
	selectedEvent: EventInfo | null;
	workerDetails: WorkerDetails;
	loading: boolean;
	onStatusChange: (userId: string, status: string) => void;
	onOpenEvent: () => void;
}

export const AdminWorkerModal: React.FC<AdminWorkerModalProps> = ({
	visible,
	onClose,
	selectedEvent,
	workerDetails,
	loading,
	onStatusChange,
	onOpenEvent,
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
							Event Worker Status
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

					{/* Event Info */}
					{selectedEvent && (
						<View
							style={[
								styles.eventInfo,
								{
									backgroundColor: theme.Background,
									borderBottomColor: theme.BorderColor,
								},
							]}
						>
							<Text
								variant="h3"
								weight="bold"
								color="primary"
								style={styles.eventTitle}
							>
								{selectedEvent.title}
							</Text>
							<Text
								variant="caption"
								color="secondary"
								style={styles.eventDate}
							>
								{selectedEvent.date}
							</Text>
							<Text variant="caption" color="secondary">
								📍 {selectedEvent.location}
							</Text>
						</View>
					)}

					{/* Worker Sections */}
					<ScrollView style={styles.body}>
						{loading ? (
							<LoadingScreen
								message="Loading worker details..."
								fullScreen={false}
							/>
						) : (
							<>
								<WorkerSection
									title="Confirmed"
									icon="checkmark-circle"
									iconColor={theme.NotificationGreen}
									workers={workerDetails.confirmed}
									actions={[
										{
											label: "Decline",
											status: "declined",
											color: Clock.ClockOut,
											icon: "close-circle",
										},
									]}
									onStatusChange={onStatusChange}
									emptyText="No confirmed workers"
								/>
								<WorkerSection
									title="Unconfirmed"
									icon="help-circle-outline"
									iconColor="#F59E0B"
									workers={workerDetails.unconfirmed}
									actions={[
										{
											label: "Decline",
											status: "declined",
											color: Clock.ClockOut,
											icon: "close-circle",
										},
										{
											label: "Confirm",
											status: "confirmed",
											color: theme.NotificationGreen,
											icon: "checkmark-circle",
										},
									]}
									onStatusChange={onStatusChange}
									emptyText="No unconfirmed workers"
								/>
								<WorkerSection
									title="Declined"
									icon="close-circle-outline"
									iconColor={Clock.ClockOut}
									workers={workerDetails.declined}
									actions={[
										{
											label: "Confirm",
											status: "confirmed",
											color: theme.NotificationGreen,
											icon: "checkmark-circle",
										},
									]}
									onStatusChange={onStatusChange}
									emptyText="No declined workers"
								/>
							</>
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
							title="Close"
							onPress={onClose}
							style={styles.footerButton}
						/>
						<Button
							variant="primary"
							title="Open Event"
							onPress={onOpenEvent}
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
		width: "95%",
		maxHeight: "90%",
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
	eventInfo: {
		padding: Spacing.xl,
		borderBottomWidth: 1,
	},
	eventTitle: {
		marginBottom: 4,
	},
	eventDate: {
		marginBottom: 2,
	},
	body: {
		maxHeight: 400,
	},
	footer: {
		flexDirection: "row",
		padding: Spacing.xl,
		borderTopWidth: 1,
		gap: Spacing.md,
	},
	footerButton: {
		flex: 1,
	},
});
