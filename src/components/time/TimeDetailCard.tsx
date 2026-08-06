import React, { useState, useCallback, useEffect } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	TextInput,
	ActivityIndicator,
	Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format } from "date-fns";
import {
	formatDuration,
	getStatusTone,
	getStatusBadgeText,
} from "../../utils/timeUtils";
import FormFieldValue from "./FormFieldValue";
import { getPackagesByIds } from "../../services/libraryService";
import { getEvent } from "../../services/eventService";
import { getEdits } from "../../services/timeEntryEditService";
import type { TimeEntryEdit } from "../../types";
import { useUser } from "../../contexts/UserContext";
import { useCompanyMembers } from "../../hooks/useCompanyMembers";
import { useCompany } from "../../contexts/CompanyContext";
import { timeDetailCardStyles } from "./TimeDetailCard.styles";
import { Badge } from "../ui";
import { useTheme, useThemedStyles } from "../../theme";

const TimeDetailCard = ({
	entry,
	isSelected,
	isAdmin,
	onToggleSelection,
	onEditEntry,
	attachmentMap,
	connectedEvents,
	onFieldUpdate,
	timeEntrySchema = null,
	eventSchema = null,
}) => {
	const theme = useTheme();
	const styles = useThemedStyles(timeDetailCardStyles);
	// Existing state variables
	const [editingFields, setEditingFields] = useState({});
	const [fieldValues, setFieldValues] = useState({});
	const [savingFields, setSavingFields] = useState({});
	const { companyId } = useUser();
	const { byUserId: membersById } = useCompanyMembers(companyId ?? "");
	const { preferences } = useCompany();
	/*
	 * Resolved by the parent from entry.formSchemaIds. v1 embedded a full copy
	 * of both schemas on every entry (`generalForm` / `eventForm`); reading
	 * those names on a current document yields null, so this card rendered no
	 * form responses at all.
	 */
	const customForm = timeEntrySchema;
	const eventForm = eventSchema;

	// Add state for event packages
	const [eventPackages, setEventPackages] = useState({});
	const [loadingPackages, setLoadingPackages] = useState(false);

	/*
	 * Edits live in a subcollection now, not an array on the entry. Loaded
	 * per card because a payroll list renders many cards and most are never
	 * expanded.
	 */
	const [edits, setEdits] = useState<TimeEntryEdit[]>([]);

	useEffect(() => {
		if (!entry?.id) return;
		let cancelled = false;
		getEdits(entry.id).then((next) => {
			if (!cancelled) setEdits(next);
		});
		return () => {
			cancelled = true;
		};
	}, [entry?.id]);

	// Move useEffect to the top level of the component
	useEffect(() => {
		const fetchAllEventPackages = async () => {
			if (!connectedEvents || connectedEvents.length === 0) return;

			setLoadingPackages(true);
			const packagesMap = {};

			try {
				// Only fetch packages for real events (not custom lists)
				/*
				 * `eventId` is null for ad-hoc entries now. v1 sniffed for a
				 * "custom_" prefix while the writer emitted "custom-", so the
				 * filter never matched and all 1,984 of them fired a doomed
				 * package lookup.
				 */
				const realEvents = connectedEvents.filter(
					(event) => event.eventId,
				);

				// Fetch packages for each real event
				// Resolve each event, then ONE batched package query for all of
				// them. v1 looped sequentially, and each getEventPackages was
				// itself an N+1 over the event's package ids.
				const events = await Promise.all(
					realEvents.map((e) => getEvent(e.eventId)),
				);
				const allPackageIds = events.flatMap(
					(e) => e?.packageIds ?? [],
				);
				const packages = await getPackagesByIds(
					companyId,
					allPackageIds,
				);

				events.forEach((event, index) => {
					if (!event) return;
					const forEvent = (event.packageIds ?? [])
						.map((id) => packages.find((p) => p.id === id))
						.filter(Boolean);
					if (forEvent.length) {
						packagesMap[realEvents[index].eventId] = forEvent;
					}
				});

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
		// Ad-hoc entries have no event, so no packages.
		if (!connection.eventId) {
			return null;
		}

		const packages = eventPackages[connection.eventId] || [];

		if (loadingPackages) {
			return (
				<View style={styles.packageInfoSection}>
					<ActivityIndicator
						size="small"
						color={theme.colors.accent}
					/>
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
							color={theme.colors.accent}
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
			return (
				<ActivityIndicator size="small" color={theme.colors.accent} />
			);
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
								<Icon
									name="check"
									size={20}
									color={theme.colors.onAccent}
								/>
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
								<Icon
									name="check"
									size={20}
									color={theme.colors.onAccent}
								/>
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
					<Icon name="pencil" size={16} color={theme.colors.accent} />
				</TouchableOpacity>
			</View>
		);
	};

	// Add this helper function inside the TimeDetailCard component
	const formatPauseDuration = (totalSeconds) => {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds}s`;
		} else {
			return `${seconds}s`;
		}
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
								color={theme.colors.accent}
							/>
						</TouchableOpacity>
					)}
					<Text style={styles.dateTimeText}>
						{format(entry.clockInAt.toDate(), "EEE, MMM d, yyyy")}
					</Text>
				</View>
				{/*
				 * Foreground follows the tone as well as the fill. A subtle
				 * amber background under permanently-grey text was the
				 * lowest-contrast pairing in the app.
				 */}
				<Badge
					label={getStatusBadgeText(entry.status)}
					tone={getStatusTone(entry.status)}
					style={styles.statusBadge}
				/>
			</View>

			{/*
			 * Who decided, and how much to trust it.
			 *
			 * v1's approve button wrote rejectedAt/rejectedBy, so 2,104 of
			 * 2,116 approved entries have an approver INFERRED from the fields
			 * the bug happened to fill. Presenting that as fact would be
			 * misleading, so migrated records say so.
			 */}
			{entry.review && (
				<View style={styles.reviewLine}>
					<Text style={styles.reviewText}>
						{entry.review.decision === "approved"
							? "Approved"
							: "Rejected"}
						{entry.review.decidedAt &&
							` ${format(
								entry.review.decidedAt.toDate(),
								"MMM d, yyyy",
							)}`}
						{entry.review.decidedBy &&
							` • ${
								membersById[entry.review.decidedBy]
									?.displayName ?? "Former member"
							}`}
					</Text>
					{entry.review.provenance !== "trusted" && (
						<Text style={styles.reviewCaveat}>
							{entry.review.provenance ===
							"inferred_from_status_bug"
								? "Approver inferred from a pre-2026 record"
								: "Approver not recorded"}
						</Text>
					)}
					{entry.review.reason ? (
						<Text style={styles.reviewCaveat}>
							{entry.review.reason}
						</Text>
					) : null}
				</View>
			)}

			<View style={styles.timeEntryDetails}>
				{/* Time details */}
				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Clock In:</Text>
					<Text style={styles.detailValue}>
						{format(entry.clockInAt.toDate(), "h:mm a")}
					</Text>
				</View>

				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Clock Out:</Text>
					<Text style={styles.detailValue}>
						{entry.clockOutAt
							? format(entry.clockOutAt.toDate(), "h:mm a")
							: "N/A"}
					</Text>
				</View>

				<View style={styles.detailRow}>
					<Text style={styles.detailLabel}>Duration:</Text>
					<Text style={styles.detailValue}>
						{entry.workedSeconds
							? formatDuration(entry.workedSeconds) +
								" (" +
								(entry.workedSeconds / 3600).toFixed(2) +
								" hrs)"
							: "N/A"}
					</Text>
				</View>

				{/* Total Pause Duration - only show if there's pause time */}
				{entry.pausedSeconds > 0 && (
					<View style={styles.detailRow}>
						<Text style={styles.detailLabel}>Paused:</Text>
						<Text style={styles.pauseValue}>
							{formatPauseDuration(entry.pausedSeconds)}
						</Text>
					</View>
				)}

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
											color={theme.colors.accent}
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
				{/*
				 * v1 read `edit.userName` and `edit.changeSummary` — a key set
				 * NO writer ever produced. Every edit therefore rendered with
				 * a blank author and the fallback text "Entry edited". These
				 * are the fields the edits documents actually carry.
				 */}
				{edits.length > 0 && (
					<View style={styles.editHistorySection}>
						<Text style={styles.sectionTitle}>Edit History</Text>

						{edits.map((edit) => (
							<View key={edit.id} style={styles.editHistoryItem}>
								<Text style={styles.editTimestamp}>
									{edit.at
										? format(
												edit.at.toDate(),
												"MMM d, yyyy h:mm a",
											)
										: "Unknown time"}
									{edit.actorDisplayName &&
										` • ${edit.actorDisplayName}`}
								</Text>
								<Text style={styles.editSummary}>
									{edit.summary || "Entry edited"}
								</Text>
							</View>
						))}
					</View>
				)}

				{/* Actions */}
				{!(entry.status === "active" || entry.status === "paused") &&
				(isAdmin || preferences?.allowUserEventEditing) ? (
					<View style={styles.entryActions}>
						<TouchableOpacity
							style={styles.editButton}
							onPress={() => onEditEntry(entry)}
						>
							<Icon
								name="pencil"
								size={16}
								color={theme.colors.accent}
							/>
							<Text style={styles.editButtonText}>Edit</Text>
						</TouchableOpacity>
					</View>
				) : null}
			</View>
		</View>
	);
};

export default TimeDetailCard;
