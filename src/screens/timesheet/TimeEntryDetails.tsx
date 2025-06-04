import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	getTimeEntry,
	updateTimeEntry,
	getTimeEntryAttachments,
	deleteTimeEntry,
} from "../../services/timeEntryService";
import { getUser } from "../../services/userService";
import { getCompanyPreferences } from "../../services/companyService";
import { getEventsByIds } from "../../services/eventService";
import { getStatusBadgeColor, getStatusBadgeText } from "../../utils/timeUtils";
import TimeEntrySummary from "../../components/time/TimeEntrySummary";
import TimeDetailCard from "../../components/time/TimeDetailCard";
import ManagerActions from "../../components/time/ManagerActions";
import EditSheet from "../../components/time/EditSheet";
import ExportSheet from "../../components/time/ExportSheet";
import FieldTotalsCard from "../../components/time/FieldTotalsCard";

const TimeEntryDetails = ({ route, navigation }) => {
	// Extract params - handle both single ID and array of IDs
	const { entryId, userId: passedUserId } = route.params;
	const entryIdArray = Array.isArray(entryId) ? entryId : [entryId];

	const insets = useSafeAreaInsets();
	const { userId: currentUserId, companyId, isAdmin } = useUser();
	const { preferences } = useCompany();

	// Core state
	const [isLoading, setIsLoading] = useState(true);
	const [timeEntries, setTimeEntries] = useState([]);
	const [employeeUser, setEmployeeUser] = useState(null);
	const [customForm, setCustomForm] = useState(null);
	const [eventForm, setEventForm] = useState(null);
	const [connectedEvents, setConnectedEvents] = useState({});
	const [attachmentMap, setAttachmentsMap] = useState({});

	// Calculations
	const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
	const [totalDurationDecimal, setTotalDurationDecimal] = useState(0);
	const [fieldTotals, setFieldTotals] = useState({});

	// UI state
	const [selectedEntries, setSelectedEntries] = useState({});
	const [selectAll, setSelectAll] = useState(false);
	const [isApproving, setIsApproving] = useState(false);

	// Modal state
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [exportModalVisible, setExportModalVisible] = useState(false);
	const [currentEditEntry, setCurrentEditEntry] = useState(null);
	const [editNotes, setEditNotes] = useState("");
	const [editChangeSummary, setEditChangeSummary] = useState("");

	// Bottom sheet refs
	const editBottomSheetRef = useRef(null);
	const exportBottomSheetRef = useRef(null);

	// Bottom sheet snap points
	const editSnapPoints = useRef(["90%"]).current;
	const exportSnapPoints = useRef(["70%"]).current;

	// Load data on mount
	useEffect(() => {
		loadTimeEntries();
	}, []);

	// Handle bottom sheet visibility
	useEffect(() => {
		if (editModalVisible && editBottomSheetRef.current) {
			editBottomSheetRef.current.expand();
		} else if (!editModalVisible && editBottomSheetRef.current) {
			editBottomSheetRef.current.close();
		}
	}, [editModalVisible]);

	useEffect(() => {
		if (exportModalVisible && exportBottomSheetRef.current) {
			exportBottomSheetRef.current.expand();
		} else if (!exportModalVisible && exportBottomSheetRef.current) {
			exportBottomSheetRef.current.close();
		}
	}, [exportModalVisible]);

	// Core data loading function
	const loadTimeEntries = async () => {
		try {
			// Fetch entries and filter out nulls
			const entries = await Promise.all(
				entryIdArray.map((id) => getTimeEntry(companyId, id)),
			);
			const validEntries = entries.filter((entry) => entry);
			setTimeEntries(validEntries);

			// Fetch attachments
			const attachments = {};
			await Promise.all(
				validEntries.map(async (entry) => {
					try {
						const entryAttachments = await getTimeEntryAttachments(
							companyId,
							entry.id,
						);
						attachments[entry.id] = entryAttachments;
					} catch (error) {
						console.error(
							`Error fetching attachments for entry ${entry.id}:`,
							error,
						);
						attachments[entry.id] = [];
					}
				}),
			);
			setAttachmentsMap(attachments);

			// Calculate totals
			const totalSeconds = validEntries.reduce(
				(sum, entry) => sum + (entry.duration || 0),
				0,
			);
			setTotalDurationSeconds(totalSeconds);
			setTotalDurationDecimal(+(totalSeconds / 3600).toFixed(2));

			// Initialize selection state
			const initialSelection = {};
			validEntries.forEach((entry) => {
				initialSelection[entry.id] = false;
			});
			setSelectedEntries(initialSelection);

			// Get employee info
			const userId = validEntries[0]?.userId || passedUserId;
			if (userId) {
				const user = await getUser(userId);
				setEmployeeUser(user);
			}

			// Get forms
			if (validEntries.length > 0) {
				const prefs = await getCompanyPreferences(companyId);
				if (prefs?.eventForm) setEventForm(prefs.eventForm);
				if (prefs?.timeEntryForm) {
					setCustomForm(prefs.timeEntryForm);
					// Calculate field totals after setting both forms
					const totals = calculateFieldTotals(
						validEntries,
						prefs.timeEntryForm,
						prefs.eventForm,
					);
					setFieldTotals(totals);
				}
			}

			// Get connected events
			const entryConnectionMap = {};

			// Just organize the connections by entry, don't try to fetch actual events
			validEntries.forEach((entry) => {
				if (entry.connectedEvents && entry.connectedEvents.length > 0) {
					// Initialize the array for this entry with the connection data we already have
					entryConnectionMap[entry.id] = entry.connectedEvents.map(
						(connection: any) => ({
							...connection,
							// Include minimal default properties to avoid UI errors
							title: connection.eventTitle || "Connected Event",
							formResponses: connection.formResponses || {},
						}),
					);
				} else {
					entryConnectionMap[entry.id] = [];
				}
			});

			setConnectedEvents(entryConnectionMap);
		} catch (error) {
			console.error("Error loading time entry details:", error);
			Alert.alert("Error", "Failed to load time entry details");
		} finally {
			setIsLoading(false);
		}
	};

	// Toggle selection for a specific entry
	const toggleEntrySelection = useCallback((entryId) => {
		setSelectedEntries((prev) => ({
			...prev,
			[entryId]: !prev[entryId],
		}));
	}, []);

	// Toggle select all entries
	const toggleSelectAll = useCallback(() => {
		const newValue = !selectAll;
		setSelectAll(newValue);

		const updatedSelection = {};
		timeEntries.forEach((entry) => {
			updatedSelection[entry.id] = newValue;
		});
		setSelectedEntries(updatedSelection);
	}, [selectAll, timeEntries]);

	// Get IDs of selected entries
	const getSelectedEntryIds = useCallback(() => {
		return Object.keys(selectedEntries).filter((id) => selectedEntries[id]);
	}, [selectedEntries]);

	// Edit entry handler
	const handleEditEntry = useCallback((entry) => {
		setCurrentEditEntry(entry);
		setEditNotes(entry.notes || "");
		setEditChangeSummary("");
		setEditModalVisible(true);
	}, []);

	// Handlers for bottom sheets
	const handleEditSheetClose = useCallback(() => {
		setEditModalVisible(false);
	}, []);

	const handleExportSheetClose = useCallback(() => {
		setExportModalVisible(false);
	}, []);

	// Update the calculateFieldTotals function
	const calculateFieldTotals = (entries, form, evForm) => {
		// Initialize an empty totals object
		const totals = {};

		if (!entries || entries.length === 0) {
			return totals;
		}

		// Process time entry form fields
		if (form && form.fields) {
			// Find fields that have showTotal enabled
			const fieldsToTotal = form.fields.filter(
				(field) =>
					field.showTotal === true &&
					(field.type === "number" ||
						field.type === "currency" ||
						field.type === "quantity"),
			);

			if (fieldsToTotal.length > 0) {
				// Initialize totals object with field info
				fieldsToTotal.forEach((field) => {
					totals[`te_${field.id}`] = {
						label: field.label,
						total: 0,
						unit: field.unit || "",
						useMultiplier: field.useMultiplier || false,
						multiplier: field.multiplier || 1,
						type: field.type,
						source: "timeEntry",
					};
				});

				// Calculate totals from all time entries
				entries.forEach((entry) => {
					if (!entry.formResponses) return;

					fieldsToTotal.forEach((field) => {
						const value = entry.formResponses[field.id];
						if (value !== undefined && value !== null) {
							const numValue = parseFloat(value);
							if (!isNaN(numValue)) {
								totals[`te_${field.id}`].total += numValue;

								// Store the raw total before multiplier is applied
								totals[`te_${field.id}`].rawTotal =
									totals[`te_${field.id}`].total;

								// If this field uses a multiplier, calculate multiplied value
								if (field.useMultiplier && field.multiplier) {
									totals[`te_${field.id}`].multipliedTotal =
										totals[`te_${field.id}`].total *
										field.multiplier;
								}
							}
						}
					});
				});
			}
		}

		// Process event form fields
		if (evForm && evForm.fields) {
			// Find event fields that have showTotal enabled
			const eventFieldsToTotal = evForm.fields.filter(
				(field) =>
					field.showTotal === true &&
					(field.type === "number" ||
						field.type === "currency" ||
						field.type === "quantity"),
			);

			if (eventFieldsToTotal.length > 0) {
				// Initialize totals object with event field info
				eventFieldsToTotal.forEach((field) => {
					totals[`ev_${field.id}`] = {
						label: `${field.label} (Events)`,
						total: 0,
						unit: field.unit || "",
						useMultiplier: field.useMultiplier || false,
						multiplier: field.multiplier || 1,
						type: field.type,
						source: "event",
					};
				});

				// Calculate totals from all connected events
				entries.forEach((entry) => {
					// Skip if no connected events
					if (
						!entry.connectedEvents ||
						entry.connectedEvents.length === 0
					)
						return;

					// Process each connected event
					entry.connectedEvents.forEach((connection) => {
						if (!connection.formResponses) return;

						eventFieldsToTotal.forEach((field) => {
							const value = connection.formResponses[field.id];
							if (value !== undefined && value !== null) {
								const numValue = parseFloat(value);
								if (!isNaN(numValue)) {
									totals[`ev_${field.id}`].total += numValue;

									// Store the raw total before multiplier is applied
									totals[`ev_${field.id}`].rawTotal =
										totals[`ev_${field.id}`].total;

									// If this field uses a multiplier, calculate multiplied value
									if (
										field.useMultiplier &&
										field.multiplier
									) {
										totals[
											`ev_${field.id}`
										].multipliedTotal =
											totals[`ev_${field.id}`].total *
											field.multiplier;
									}
								}
							}
						});
					});
				});
			}
		}

		return totals;
	};

	// Add this useEffect
	useEffect(() => {
		if (timeEntries.length > 0 && (customForm || eventForm)) {
			const totals = calculateFieldTotals(
				timeEntries,
				customForm,
				eventForm,
			);
			setFieldTotals(totals);
		}
	}, [timeEntries, customForm, eventForm]);

	// If still loading, show loading indicator
	if (isLoading) {
		return (
			<View style={[styles.container, styles.loadingContainer]}>
				<ActivityIndicator size="large" color="#007AFF" />
				<Text style={styles.loadingText}>
					Loading time entry details...
				</Text>
			</View>
		);
	}

	const handleApproveEntries = async (entryIds: string[]) => {
		if (entryIds.length === 0) {
			Alert.alert(
				"No entries selected",
				"Please select entries to approve.",
			);
			return;
		}

		try {
			setIsApproving(true);

			// Process each entry sequentially
			for (const entryId of entryIds) {
				await updateTimeEntry(entryId, companyId, {
					status: "approved",
					rejectedAt: new Date().toISOString(),
					rejectedBy: currentUserId,
				});
			}

			// Reload the time entries to reflect the changes
			await loadTimeEntries();

			// Clear selection after successful approval
			setSelectAll(false);
			const resetSelection = {};
			timeEntries.forEach((entry) => {
				resetSelection[entry.id] = false;
			});
			setSelectedEntries(resetSelection);

			// Show success message
			Alert.alert(
				"Success",
				`${entryIds.length} time ${
					entryIds.length === 1 ? "entry" : "entries"
				} approved successfully.`,
			);
		} catch (error) {
			console.error("Error approving time entries:", error);
			Alert.alert(
				"Error",
				"Failed to approve time entries. Please try again.",
			);
		} finally {
			setIsApproving(false);
		}
	};

	const handleRejectEntries = async (entryIds: string[]) => {
		if (entryIds.length === 0) {
			Alert.alert(
				"No entries selected",
				"Please select entries to reject.",
			);
			return;
		}

		// Show rejection confirmation dialog
		Alert.alert(
			"Confirm Rejection",
			"Are you sure you want to reject the selected time entries?",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Reject",
					style: "destructive",
					onPress: async () => {
						try {
							setIsApproving(true); // Reuse loading state for rejection

							// Process each entry sequentially
							for (const entryId of entryIds) {
								// Update the time entry status to "rejected"
								await updateTimeEntry(entryId, companyId, {
									status: "rejected",
									rejectedAt: new Date().toISOString(),
									rejectedBy: currentUserId,
								});
							}

							// Reload the time entries to reflect the changes
							await loadTimeEntries();

							// Clear selection after successful rejection
							setSelectAll(false);
							const resetSelection = {};
							timeEntries.forEach((entry) => {
								resetSelection[entry.id] = false;
							});
							setSelectedEntries(resetSelection);

							// Show success message
							Alert.alert(
								"Success",
								`${entryIds.length} time ${
									entryIds.length === 1 ? "entry" : "entries"
								} rejected successfully.`,
							);
						} catch (error) {
							console.error(
								"Error rejecting time entries:",
								error,
							);
							Alert.alert(
								"Error",
								"Failed to reject time entries. Please try again.",
							);
						} finally {
							setIsApproving(false);
						}
					},
				},
			],
		);
	};

	// Function to save edited time entry
	const saveEditedEntry = async (updates: any) => {
		if (!currentEditEntry) return;

		try {
			// Prepare updated data
			const updatedData = {
				...updates,
				editHistory: [
					...(currentEditEntry.editHistory || []),
					{
						timestamp: new Date().toISOString(),
						userId: currentUserId,
						changeSummary:
							editChangeSummary || "Updated time entry",
					},
				],
			};

			// Update the time entry
			await updateTimeEntry(currentEditEntry.id, companyId, updatedData);

			// Close the edit modal
			setEditModalVisible(false);

			// Reload time entries to reflect changes
			await loadTimeEntries();

			// Show success message
			Alert.alert("Success", "Time entry updated successfully");
		} catch (error) {
			console.error("Error updating time entry:", error);
			Alert.alert(
				"Error",
				"Failed to update time entry. Please try again.",
			);
		}
	};

	// Function to handle time entry deletion
	const handleDeleteTimeEntry = () => {
		if (!currentEditEntry) return;

		// Show confirmation dialog
		Alert.alert(
			"Confirm Deletion",
			"Are you sure you want to delete this time entry? This action cannot be undone.",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							// Delete the time entry
							await deleteTimeEntry(
								companyId,
								currentEditEntry.id,
							);

							// Close the edit modal
							setEditModalVisible(false);

							// If we're viewing a single entry, navigate back
							if (timeEntries.length === 1) {
								navigation.goBack();
								return;
							}

							// Otherwise reload the remaining entries
							await loadTimeEntries();

							// Show success message
							Alert.alert(
								"Success",
								"Time entry deleted successfully",
							);
						} catch (error) {
							console.error("Error deleting time entry:", error);
							Alert.alert(
								"Error",
								"Failed to delete time entry. Please try again.",
							);
						}
					},
				},
			],
		);
	};

	// Add this function to handle individual field updates
	const handleFieldUpdate = async (entryId, fieldId, value) => {
		try {
			// For entry fields
			if (!fieldId.includes("_")) {
				// Update a single field in the form responses
				const entry = timeEntries.find((e) => e.id === entryId);
				if (!entry) throw new Error("Entry not found");

				const updatedFormResponses = {
					...entry.formResponses,
					[fieldId]: value,
				};

				// Update the time entry with just the form responses
				await updateTimeEntry(entryId, companyId, {
					formResponses: updatedFormResponses,
					editHistory: [
						...(entry.editHistory || []),
						{
							timestamp: new Date().toISOString(),
							userId: currentUserId,
							changeSummary: `Updated field: ${
								customForm?.fields.find((f) => f.id === fieldId)
									?.label || fieldId
							}`,
						},
					],
				});
			}
			// For connected event fields
			else {
				const [eventId, eventFieldId] = fieldId.split("_");

				// Find the right entry and connected event
				const entry = timeEntries.find((e) => e.id === entryId);
				if (!entry || !entry.connectedEvents)
					throw new Error("Entry or connected events not found");

				// Update the connected event's form responses
				const updatedConnectedEvents = entry.connectedEvents.map(
					(event) => {
						if (event.eventId === eventId) {
							return {
								...event,
								formResponses: {
									...(event.formResponses || {}),
									[eventFieldId]: value,
								},
							};
						}
						return event;
					},
				);

				// Update the time entry with just the connected events
				await updateTimeEntry(entryId, companyId, {
					connectedEvents: updatedConnectedEvents,
					editHistory: [
						...(entry.editHistory || []),
						{
							timestamp: new Date().toISOString(),
							userId: currentUserId,
							changeSummary: `Updated event field: ${
								eventForm?.fields.find(
									(f) => f.id === eventFieldId,
								)?.label || eventFieldId
							}`,
						},
					],
				});
			}

			// Refresh the data
			await loadTimeEntries();
		} catch (error) {
			console.error("Error updating field:", error);
			throw error;
		}
	};

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			{/* Header */}
			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					style={styles.backButton}
				>
					<Icon name="arrow-left" size={24} color="#007AFF" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>
					{timeEntries.length > 1 ? "Time Entries" : "Time Entry"}
				</Text>
				{isAdmin && (
					<TouchableOpacity
						onPress={() => setExportModalVisible(true)}
					>
						<Icon name="export-variant" size={24} color="#007AFF" />
					</TouchableOpacity>
				)}
			</View>

			<ScrollView style={styles.scrollContainer}>
				{/* Summary Card */}
				<TimeEntrySummary
					status={timeEntries[0]?.status || "draft"}
					employeeUser={employeeUser}
					totalDurationSeconds={totalDurationSeconds}
					totalDurationDecimal={totalDurationDecimal}
					timeEntries={timeEntries}
					getStatusBadgeColor={getStatusBadgeColor}
					getStatusBadgeText={getStatusBadgeText}
				/>

				{/* Field Totals Card - Add this new component */}
				{Object.keys(fieldTotals).length > 0 && (
					<FieldTotalsCard fieldTotals={fieldTotals} />
				)}

				{/* Manager Actions */}
				{isAdmin && timeEntries.length > 0 && (
					<ManagerActions
						selectAll={selectAll}
						toggleSelectAll={toggleSelectAll}
						selectedCount={getSelectedEntryIds().length}
						totalCount={timeEntries.length}
						isApproving={isApproving}
						onApprove={() =>
							handleApproveEntries(getSelectedEntryIds())
						}
						onReject={() =>
							handleRejectEntries(getSelectedEntryIds())
						}
					/>
				)}

				{/* Time Entries List */}
				{timeEntries.map((entry) => (
					<TimeDetailCard
						key={entry.id}
						entry={entry}
						isSelected={selectedEntries[entry.id]}
						isAdmin={isAdmin}
						customForm={customForm}
						eventForm={eventForm}
						onToggleSelection={toggleEntrySelection}
						onEditEntry={handleEditEntry}
						attachmentMap={attachmentMap}
						connectedEvents={connectedEvents[entry.id] || []}
						onFieldUpdate={handleFieldUpdate}
					/>
				))}
			</ScrollView>

			{/* Edit Modal */}
			<EditSheet
				ref={editBottomSheetRef}
				visible={editModalVisible}
				snapPoints={editSnapPoints}
				timeEntry={currentEditEntry}
				customForm={customForm}
				eventForm={eventForm}
				editNotes={editNotes}
				editChangeSummary={editChangeSummary}
				setEditNotes={setEditNotes}
				setEditChangeSummary={setEditChangeSummary}
				onClose={handleEditSheetClose}
				onSave={saveEditedEntry}
				onDelete={handleDeleteTimeEntry}
			/>

			{/* Export Modal */}
			<ExportSheet
				ref={exportBottomSheetRef}
				visible={exportModalVisible}
				snapPoints={exportSnapPoints}
				onClose={handleExportSheetClose}
				selectedEntries={getSelectedEntryIds()}
				timeEntries={timeEntries}
				employeeUser={employeeUser}
				companyId={companyId}
				customForm={customForm}
			/>
		</View>
	);
};

// Keep just the styles needed for the main component
const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f7f7f7",
	},
	loadingContainer: {
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 16,
		fontSize: 16,
		color: "#666",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
	},
	backButton: {
		padding: 4,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		flex: 1,
		textAlign: "center",
	},
	scrollContainer: {
		flex: 1,
	},
	// Bottom sheet styles
	sheetBackground: {
		backgroundColor: "white",
	},
	sheetIndicator: {
		backgroundColor: "#ccc",
		width: 40,
		height: 4,
	},
	sheetHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#eaeaea",
	},
	sheetContent: {
		padding: 20,
		paddingBottom: 40,
	},
	summaryCard: {
		margin: 16,
		padding: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	summaryRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginBottom: 12,
		alignItems: "center",
	},
	totalSummaryRow: {
		marginTop: 8,
	},
	summaryLabel: {
		fontSize: 16,
		color: "#666",
		fontWeight: "500",
	},
	summaryValue: {
		fontSize: 14,
		color: "#333",
		fontWeight: "500",
		textAlign: "right",
		flex: 1,
	},
	totalValue: {
		fontWeight: "600",
		color: "#007AFF",
	},
	statusContainer: {
		flexDirection: "row",
		justifyContent: "flex-end",
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
	managerActionsCard: {
		margin: 16,
		marginTop: 0,
		padding: 16,
		backgroundColor: "#fff",
		borderRadius: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	selectAllRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
	},
	selectAllButton: {
		flexDirection: "row",
		alignItems: "center",
	},
	selectAllText: {
		marginLeft: 8,
		fontSize: 16,
		color: "#007AFF",
		fontWeight: "500",
	},
	selectedCountText: {
		fontSize: 14,
		color: "#666",
	},
	managerButtonRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 10,
	},
	managerActionButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		flex: 1,
	},
	approveButton: {
		backgroundColor: "#34C759",
	},
	emailButton: {
		backgroundColor: "#007AFF",
	},
	rejectButton: {
		backgroundColor: "#FF3B30",
	},
	disabledButton: {
		opacity: 0.5,
	},
	buttonText: {
		color: "#fff",
		fontWeight: "600",
		marginLeft: 8,
	},
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
	connectedEventsSection: {
		marginTop: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginBottom: 8,
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
	notesSection: {
		marginTop: 16,
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
	formFieldValue: {
		fontSize: 15,
		color: "#333",
	},
	multiplierValue: {
		fontSize: 14,
		color: "#007AFF",
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
		backgroundColor: "#f0f7ff",
		borderRadius: 6,
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
	modal: {
		margin: 0,
		justifyContent: "flex-end",
	},
	modalContent: {
		backgroundColor: "#fff",
		borderTopLeftRadius: 12,
		borderTopRightRadius: 12,
		padding: 20,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		marginBottom: 4,
		textAlign: "center",
	},
	modalForm: {
		marginBottom: 20,
	},
	modalLabel: {
		fontSize: 15,
		fontWeight: "500",
		color: "#333",
		marginBottom: 8,
	},
	modalInput: {
		height: 44,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		marginBottom: 16,
	},
	modalTextArea: {
		height: 100,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingTop: 12,
		paddingBottom: 12,
		fontSize: 16,
		marginBottom: 16,
		textAlignVertical: "top",
	},
	modalButtons: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	modalButton: {
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		flex: 1,
	},
	modalCancelButton: {
		backgroundColor: "#f2f2f2",
		marginRight: 8,
	},
	modalSaveButton: {
		backgroundColor: "#007AFF",
		marginLeft: 8,
	},
	modalCancelButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#666",
	},
	modalSaveButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
	},
	exportOptionRow: {
		marginBottom: 20,
	},
	exportOptions: {
		flexDirection: "row",
		marginTop: 8,
	},
	exportOption: {
		flex: 1,
		paddingVertical: 10,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#ddd",
		marginHorizontal: 4,
		borderRadius: 6,
	},
	selectedExportOption: {
		borderColor: "#007AFF",
		backgroundColor: "#f0f7ff",
	},
	exportOptionText: {
		fontSize: 15,
		color: "#666",
	},
	selectedExportOptionText: {
		color: "#007AFF",
		fontWeight: "500",
	},
	fileResponseGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginTop: 8,
	},
	fileResponseItem: {
		width: 80,
		height: 80,
		borderRadius: 8,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "#eee",
	},
	fileResponseImage: {
		width: "100%",
		height: "100%",
		resizeMode: "cover",
	},
	videoOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0,0,0,0.3)",
		justifyContent: "center",
		alignItems: "center",
	},
	fileResponseDoc: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#f5f5f5",
	},
	fileResponseVideo: {
		width: "100%",
		height: "100%",
		position: "relative",
	},
	fileResponseName: {
		fontSize: 10,
		color: "#666",
		textAlign: "center",
		paddingHorizontal: 4,
		marginTop: 4,
	},
	eventTitle: {
		fontSize: 15,
		fontWeight: "500",
		color: "#333",
		marginLeft: 8,
	},
});

export default TimeEntryDetails;
