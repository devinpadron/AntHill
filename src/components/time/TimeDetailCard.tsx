import React, { useState, useCallback, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	TextInput,
	ActivityIndicator,
	Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format } from "date-fns";
import {
	formatDuration,
	getStatusBadgeColor,
	getStatusBadgeText,
} from "../../utils/timeUtils";
import FormFieldValue from "./FormFieldValue";
import { getEventPackages } from "../../services/eventService";
import { useUser } from "../../contexts/UserContext";

const TimeDetailCard = ({
	entry,
	isSelected,
	isAdmin,
	customForm,
	eventForm,
	onToggleSelection,
	onEditEntry,
	attachmentMap,
	connectedEvents,
	onFieldUpdate,
}) => {
	// Existing state variables
	const [editingFields, setEditingFields] = useState({});
	const [fieldValues, setFieldValues] = useState({});
	const [savingFields, setSavingFields] = useState({});
	const { companyId } = useUser();

	// Add state for event packages
	const [eventPackages, setEventPackages] = useState({});
	const [loadingPackages, setLoadingPackages] = useState(false);

	// Move useEffect to the top level of the component
	useEffect(() => {
		const fetchAllEventPackages = async () => {
			if (!connectedEvents || connectedEvents.length === 0) return;

			setLoadingPackages(true);
			const packagesMap = {};

			try {
				// Only fetch packages for real events (not custom lists)
				const realEvents = connectedEvents.filter(
					(event) =>
						event.eventId && !event.eventId.includes("custom_"),
				);

				// Fetch packages for each real event
				for (const event of realEvents) {
					try {
						const packages = await getEventPackages(
							companyId,
							event.eventId,
						);
						if (packages && packages.length > 0) {
							packagesMap[event.eventId] = packages;
						}
					} catch (error) {
						console.error(
							`Error fetching packages for event ${event.eventId}:`,
							error,
						);
					}
				}

				setEventPackages(packagesMap);
			} catch (error) {
				console.error("Error fetching event packages:", error);
			} finally {
				setLoadingPackages(false);
			}
		};

		fetchAllEventPackages();
	}, [connectedEvents, companyId]); // Only re-run when connected events change

	// Add a function to render event packages
	const renderEventPackages = (connection) => {
		// Don't show packages for custom list events
		if (connection.eventId && connection.eventId.includes("custom_")) {
			return null;
		}

		const packages = eventPackages[connection.eventId] || [];

		if (loadingPackages) {
			return (
				<View style={styles.packageInfoSection}>
					<ActivityIndicator size="small" color="#007AFF" />
					<Text style={styles.packageInfoText}>
						Loading packages...
					</Text>
				</View>
			);
		}

		if (packages.length === 0) {
			return null;
		}

		return (
			<View style={styles.packageInfoSection}>
				<Text style={styles.packageSectionTitle}>Packages:</Text>
				{packages.map((pkg, index) => (
					<View key={index} style={styles.packageItem}>
						<Icon
							name="package-variant"
							size={16}
							color="#007AFF"
						/>
						<Text style={styles.packageName}>
							{pkg.title || "Unnamed Package"}
							{pkg.quantity > 1 && ` (x${pkg.quantity})`}
						</Text>
					</View>
				))}
			</View>
		);
	};

	// Helper to toggle edit mode for a field
	const toggleFieldEdit = useCallback(
		(fieldId, currentValue) => {
			setEditingFields((prev) => ({
				...prev,
				[fieldId]: !prev[fieldId],
			}));

			if (!editingFields[fieldId]) {
				// Starting to edit - store current value
				setFieldValues((prev) => ({
					...prev,
					[fieldId]: currentValue,
				}));
			}
		},
		[editingFields],
	);

	// Update field value as user types
	const updateFieldValue = useCallback((fieldId, value) => {
		setFieldValues((prev) => ({
			...prev,
			[fieldId]: value,
		}));
	}, []);

	// Save field change
	const saveFieldChange = useCallback(
		async (fieldId, fieldType) => {
			try {
				// Mark field as saving
				setSavingFields((prev) => ({
					...prev,
					[fieldId]: true,
				}));

				// Process value based on field type
				let processedValue = fieldValues[fieldId];
				if (
					fieldType === "number" ||
					fieldType === "currency" ||
					fieldType === "quantity"
				) {
					processedValue = parseFloat(processedValue);
					if (isNaN(processedValue)) {
						throw new Error("Please enter a valid number");
					}
				}

				// Call the update function from props
				await onFieldUpdate(entry.id, fieldId, processedValue);

				// Exit edit mode
				setEditingFields((prev) => ({
					...prev,
					[fieldId]: false,
				}));
			} catch (error) {
				Alert.alert("Error", error.message || "Failed to update field");
			} finally {
				setSavingFields((prev) => ({
					...prev,
					[fieldId]: false,
				}));
			}
		},
		[entry.id, fieldValues, onFieldUpdate],
	);

	// Render an editable field
	const renderEditableField = (field, value) => {
		const isEditing = editingFields[field.id];
		const isSaving = savingFields[field.id];

		if (isSaving) {
			return <ActivityIndicator size="small" color="#007AFF" />;
		}

		if (isEditing) {
			// Render appropriate input based on field type
			switch (field.type) {
				case "number":
				case "currency":
				case "quantity":
					return (
						<View style={styles.editableFieldContainer}>
							<TextInput
								style={styles.editableInput}
								value={String(fieldValues[field.id] || "")}
								onChangeText={(text) =>
									updateFieldValue(field.id, text)
								}
								keyboardType="numeric"
								autoFocus
							/>
							<TouchableOpacity
								style={styles.saveButton}
								onPress={() =>
									saveFieldChange(field.id, field.type)
								}
							>
								<Icon name="check" size={20} color="#fff" />
							</TouchableOpacity>
						</View>
					);
				default:
					return (
						<View style={styles.editableFieldContainer}>
							<TextInput
								style={styles.editableInput}
								value={String(fieldValues[field.id] || "")}
								onChangeText={(text) =>
									updateFieldValue(field.id, text)
								}
								autoFocus
							/>
							<TouchableOpacity
								style={styles.saveButton}
								onPress={() =>
									saveFieldChange(field.id, field.type)
								}
							>
								<Icon name="check" size={20} color="#fff" />
							</TouchableOpacity>
						</View>
					);
			}
		}

		// Display current value with edit icon
		return (
			<View style={styles.quickEditContainer}>
				<FormFieldValue
					field={field}
					response={value}
					attachments={attachmentMap[entry.id] || []}
				/>
				<TouchableOpacity
					style={styles.quickEditButton}
					onPress={() => toggleFieldEdit(field.id, value)}
				>
					<Icon name="pencil" size={16} color="#007AFF" />
				</TouchableOpacity>
			</View>
		);
	};

	return (
		<View style={styles.timeEntryCard}>
			<View style={styles.timeEntryHeader}>
				<View style={styles.headerLeftSection}>
					{isAdmin && (
						<TouchableOpacity
							style={styles.selectionCheckbox}
							onPress={() => onToggleSelection(entry.id)}
						>
							<Icon
								name={
									isSelected
										? "checkbox-marked"
										: "checkbox-blank-outline"
								}
								size={24}
								color="#007AFF"
							/>
						</TouchableOpacity>
					)}
					<Text style={styles.dateTimeText}>
						{format(
							new Date(entry.clockInTime),
							"EEE, MMM d, yyyy",
						)}
					</Text>
				</View>
				<View
					style={[
						styles.statusBadge,
						{ backgroundColor: getStatusBadgeColor(entry.status) },
					]}
				>
					<Text style={styles.statusText}>
						{getStatusBadgeText(entry.status)}
					</Text>
				</View>
			</View>

			<View style={styles.timeEntryDetails}>
				{/* Time details */}
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Clock In:</Text>
					<Text style={styles.detailValue}>
						{format(new Date(entry.clockInTime), "h:mm a")}
					</Text>
				</View>

				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Clock Out:</Text>
					<Text style={styles.detailValue}>
						{entry.clockOutTime
							? format(new Date(entry.clockOutTime), "h:mm a")
							: "N/A"}
					</Text>
				</View>

				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Duration:</Text>
					<Text style={styles.detailValue}>
						{entry.duration
							? formatDuration(entry.duration) +
								" (" +
								(entry.duration / 3600).toFixed(2) +
								" hrs)"
							: "N/A"}
					</Text>
				</View>

				{/* Notes Section */}
				{entry.notes && (
					<View style={styles.notesSection}>
						<Text style={styles.sectionTitle}>Notes</Text>
						<Text style={styles.notesText}>{entry.notes}</Text>
					</View>
				)}

				{/* Connected Events Section */}
				{connectedEvents && connectedEvents.length > 0 && (
					<View style={styles.connectedEventsSection}>
						<Text style={styles.sectionTitle}>
							Connected Events ({connectedEvents.length})
						</Text>

						{connectedEvents.map((connection, index) => {
							return (
								<View
									key={connection.eventId || index}
									style={styles.connectedEventContainer}
								>
									{/* Event header remains unchanged */}
									<View style={styles.connectedEventItem}>
										<Icon
											name="calendar-check"
											size={18}
											color="#007AFF"
										/>
										<Text style={styles.eventTitle}>
											{connection.eventTitle ||
												connection.title ||
												"Connected Event"}
										</Text>
									</View>

									{/* Show event type if available */}
									{connection.eventType && (
										<View style={styles.eventMetadata}>
											<Text style={styles.metadataText}>
												Type:{" "}
												{connection.eventType
													.replace(/-/g, " ")
													.replace(/\b\w/g, (c) =>
														c.toUpperCase(),
													)}
											</Text>
										</View>
									)}

									{/* Add the package information */}
									{renderEventPackages(connection)}

									{/* Form responses with quick edit support */}
									{eventForm &&
										connection.formResponses &&
										Object.keys(connection.formResponses)
											.length > 0 && (
											<View
												style={
													styles.eventFormResponsesSection
												}
											>
												<Text
													style={
														styles.eventFormTitle
													}
												>
													Event Form Responses
												</Text>
												{eventForm.fields.map(
													(field) => {
														const response =
															connection
																.formResponses[
																field.id
															];
														if (
															response ===
																undefined ||
															response === null
														)
															return null;

														const fieldKey = `${connection.eventId}_${field.id}`;

														return (
															<View
																key={fieldKey}
																style={
																	styles.formResponseItem
																}
															>
																<Text
																	style={
																		styles.formFieldLabel
																	}
																>
																	{
																		field.label
																	}
																</Text>

																{field.quickEditPayroll &&
																isAdmin ? (
																	renderEditableField(
																		{
																			...field,
																			id: fieldKey,
																		},
																		response,
																	)
																) : (
																	<FormFieldValue
																		field={
																			field
																		}
																		response={
																			response
																		}
																		attachments={
																			connection.attachments ||
																			[]
																		}
																	/>
																)}
															</View>
														);
													},
												)}
											</View>
										)}
								</View>
							);
						})}
					</View>
				)}

				{/* Form Responses with quick edit support */}
				{entry.formResponses && customForm && (
					<View style={styles.formResponsesSection}>
						<Text style={styles.sectionTitle}>
							Time Entry Form Responses
						</Text>
						{customForm.fields.map((field) => {
							const response = entry.formResponses[field.id];
							if (response === undefined || response === null)
								return null;

							return (
								<View
									key={field.id}
									style={styles.formResponseItem}
								>
									<Text style={styles.formFieldLabel}>
										{field.label}
									</Text>

									{field.quickEditPayroll && isAdmin ? (
										renderEditableField(field, response)
									) : (
										<FormFieldValue
											field={field}
											response={response}
											attachments={
												attachmentMap[entry.id] || []
											}
										/>
									)}
								</View>
							);
						})}
					</View>
				)}

				{/* Edit History Section */}
				{entry.editHistory && entry.editHistory.length > 0 && (
					<View style={styles.editHistorySection}>
						<Text style={styles.sectionTitle}>Edit History</Text>

						{entry.editHistory.map((edit, index) => (
							<View key={index} style={styles.editHistoryItem}>
								<Text style={styles.editTimestamp}>
									{format(
										new Date(edit.timestamp),
										"MMM d, yyyy h:mm a",
									)}
									{edit.userName && ` • ${edit.userName}`}
								</Text>
								<Text style={styles.editSummary}>
									{edit.changeSummary || "Entry edited"}
								</Text>
							</View>
						))}
					</View>
				)}

				{/* Actions */}
				<View style={styles.entryActions}>
					<TouchableOpacity
						style={styles.editButton}
						onPress={() => onEditEntry(entry)}
					>
						<Icon name="pencil" size={16} color="#007AFF" />
						<Text style={styles.editButtonText}>Edit</Text>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	timeEntryCard: {
		marginHorizontal: 16,
		marginBottom: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		overflow: "hidden",
	},
	timeEntryHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	headerLeftSection: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	selectionCheckbox: {
		marginRight: 12,
	},
	dateTimeText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	statusBadge: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 12,
		backgroundColor: "#e0e0e0",
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
		color: "#555",
	},
	timeEntryDetails: {
		padding: 16,
	},
	detailRow: {
		flexDirection: "row",
		marginBottom: 8,
	},
	detailLabel: {
		fontSize: 15,
		color: "#666",
		width: 80,
	},
	detailValue: {
		fontSize: 15,
		color: "#333",
		flex: 1,
	},
	notesSection: {
		marginTop: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginBottom: 8,
	},
	notesText: {
		fontSize: 15,
		color: "#333",
		lineHeight: 22,
	},
	formResponsesSection: {
		marginTop: 16,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
		paddingTop: 16,
	},
	formResponseItem: {
		marginBottom: 12,
	},
	formFieldLabel: {
		fontSize: 14,
		color: "#666",
		marginBottom: 4,
	},
	entryActions: {
		marginTop: 16,
		flexDirection: "row",
		justifyContent: "flex-end",
	},
	editButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 6,
		backgroundColor: "#f0f7ff",
	},
	editButtonText: {
		marginLeft: 6,
		fontSize: 14,
		fontWeight: "500",
		color: "#007AFF",
	},
	connectedEventsSection: {
		marginTop: 16,
	},
	connectedEventContainer: {
		marginBottom: 16,
		borderWidth: 1,
		borderColor: "#f0f0f0",
		borderRadius: 8,
		overflow: "hidden",
	},
	connectedEventItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 10,
		paddingHorizontal: 12,
		backgroundColor: "#f7f9fc",
		borderBottomColor: "#f0f0f0",
	},
	eventTitle: {
		fontSize: 15,
		fontWeight: "500",
		color: "#333",
		marginLeft: 8,
	},
	eventMetadata: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: "#f9f9f9",
	},
	metadataText: {
		fontSize: 13,
		color: "#666",
		fontStyle: "italic",
	},
	eventFormResponsesSection: {
		padding: 12,
		backgroundColor: "#ffffff",
	},
	eventFormTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		marginBottom: 8,
	},
	editHistorySection: {
		marginTop: 16,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
	},
	editHistoryItem: {
		marginBottom: 12,
		padding: 10,
		backgroundColor: "#f8f8f8",
		borderRadius: 6,
		borderLeftWidth: 3,
		borderLeftColor: "#007AFF",
	},
	editTimestamp: {
		fontSize: 13,
		color: "#666",
		marginBottom: 4,
	},
	editSummary: {
		fontSize: 14,
		color: "#333",
		fontWeight: "500",
	},
	quickEditContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	quickEditButton: {
		padding: 4,
		borderRadius: 4,
		backgroundColor: "#f0f7ff",
		marginLeft: 8,
	},
	editableFieldContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	editableInput: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#007AFF",
		borderRadius: 4,
		padding: 8,
		fontSize: 15,
		color: "#333",
		backgroundColor: "#fff",
	},
	saveButton: {
		marginLeft: 8,
		padding: 8,
		borderRadius: 4,
		backgroundColor: "#007AFF",
		alignItems: "center",
		justifyContent: "center",
	},
	packageInfoSection: {
		padding: 12,
		backgroundColor: "#f7f9fc",
		borderTopWidth: 1,
		borderTopColor: "#eeeeee",
	},
	packageSectionTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#666",
		marginBottom: 8,
	},
	packageItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 4,
	},
	packageName: {
		fontSize: 14,
		color: "#333",
		marginLeft: 8,
	},
	packageInfoText: {
		fontSize: 14,
		color: "#666",
		fontStyle: "italic",
		textAlign: "center",
		marginTop: 4,
	},
});

export default TimeDetailCard;
