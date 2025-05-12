import React, { useState } from "react";
import {
	Modal,
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { format } from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const TimeEntrySubmitModal = ({ visible, timeEntry, onClose, onSubmit }) => {
	const [notes, setNotes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState(null);

	const formatDuration = (durationSeconds) => {
		const hours = Math.floor(durationSeconds / 3600);
		const minutes = Math.floor((durationSeconds % 3600) / 60);
		return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
	};

	const handleSubmit = async () => {
		try {
			setIsSubmitting(true);
			setError(null);
			await onSubmit(timeEntry.id, notes);
			setNotes(""); // Clear notes after successful submission
			onClose(); // Close modal
		} catch (err) {
			setError("Failed to submit time entry. Please try again.");
			console.error("Error submitting time entry:", err);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!timeEntry) return null;

	return (
		<Modal
			visible={visible}
			transparent={true}
			animationType="slide"
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.modalContainer}
			>
				<View style={styles.modalContent}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Submit Time Entry</Text>
						<TouchableOpacity
							onPress={onClose}
							disabled={isSubmitting}
						>
							<Icon name="close" size={24} color="#999" />
						</TouchableOpacity>
					</View>

					<View style={styles.entryDetails}>
						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>Date:</Text>
							<Text style={styles.detailValue}>
								{format(
									new Date(timeEntry.clockInTime),
									"EEEE, MMMM d, yyyy",
								)}
							</Text>
						</View>

						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>Time:</Text>
							<Text style={styles.detailValue}>
								{format(
									new Date(timeEntry.clockInTime),
									"h:mm a",
								)}{" "}
								-{" "}
								{format(
									new Date(timeEntry.clockOutTime),
									"h:mm a",
								)}
							</Text>
						</View>

						<View style={styles.detailRow}>
							<Text style={styles.detailLabel}>Duration:</Text>
							<Text style={styles.detailValue}>
								{formatDuration(timeEntry.duration)}
							</Text>
						</View>

						{timeEntry.connectedEvents &&
							timeEntry.connectedEvents.length > 0 && (
								<View style={styles.detailRow}>
									<Text style={styles.detailLabel}>
										Events:
									</Text>
									<Text style={styles.detailValue}>
										{timeEntry.connectedEvents
											.map((e) => e.eventTitle)
											.join(", ")}
									</Text>
								</View>
							)}
					</View>

					<Text style={styles.notesLabel}>Notes/Comments:</Text>
					<TextInput
						style={styles.notesInput}
						multiline
						numberOfLines={4}
						placeholder="Add any comments about this time entry"
						value={notes}
						onChangeText={setNotes}
						editable={!isSubmitting}
					/>

					{error && <Text style={styles.errorText}>{error}</Text>}

					<View style={styles.buttonRow}>
						<TouchableOpacity
							style={[styles.button, styles.cancelButton]}
							onPress={onClose}
							disabled={isSubmitting}
						>
							<Text style={styles.cancelButtonText}>Cancel</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.button,
								styles.submitButton,
								isSubmitting && styles.disabledButton,
							]}
							onPress={handleSubmit}
							disabled={isSubmitting}
						>
							{isSubmitting ? (
								<ActivityIndicator size="small" color="white" />
							) : (
								<Text style={styles.submitButtonText}>
									Submit for Approval
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
};

const styles = StyleSheet.create({
	modalContainer: {
		flex: 1,
		justifyContent: "center",
		backgroundColor: "rgba(0,0,0,0.5)",
		padding: 16,
	},
	modalContent: {
		backgroundColor: "white",
		borderRadius: 12,
		padding: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	entryDetails: {
		backgroundColor: "#f7f7f7",
		borderRadius: 8,
		padding: 12,
		marginBottom: 16,
	},
	detailRow: {
		flexDirection: "row",
		marginBottom: 6,
	},
	detailLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		width: 70,
	},
	detailValue: {
		fontSize: 14,
		color: "#333",
		flex: 1,
	},
	notesLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
		marginBottom: 6,
	},
	notesInput: {
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 14,
		color: "#333",
		height: 100,
		textAlignVertical: "top",
		marginBottom: 16,
	},
	errorText: {
		color: "#ff3b30",
		marginBottom: 12,
	},
	buttonRow: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	button: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
	},
	cancelButton: {
		backgroundColor: "#f2f2f2",
		flex: 1,
		marginRight: 8,
	},
	submitButton: {
		backgroundColor: "#007AFF",
		flex: 2,
	},
	disabledButton: {
		backgroundColor: "#80b3ff",
	},
	cancelButtonText: {
		color: "#666",
		fontWeight: "500",
	},
	submitButtonText: {
		color: "white",
		fontWeight: "600",
	},
});

export default TimeEntrySubmitModal;
