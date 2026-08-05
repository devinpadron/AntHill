import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useUser } from "../../contexts/UserContext";
import { useCompanyMembers } from "../../hooks/useCompanyMembers";
import {
	approveEntries,
	deleteTimeEntry,
	getTimeEntry,
	rejectEntries,
	updateTimeEntry,
} from "../../services/timeEntryService";
import {
	appendEdit,
	getConnections,
	setConnections,
	updateConnectionResponses,
} from "../../services/timeEntryEditService";
import { getAttachmentsForParent } from "../../services/attachmentService";
import { getSchema } from "../../services/formSchemaService";
import {
	getStatusBadgeColor,
	getStatusBadgeText,
	calculateFieldTotals,
} from "../../utils/timeUtils";
import TimeEntrySummary from "../../components/time/TimeEntrySummary";
import TimeDetailCard from "../../components/time/TimeDetailCard";
import ManagerActions from "../../components/time/ManagerActions";
import EditSheet from "../../components/time/EditSheet";
import ExportSheet from "../../components/time/ExportSheet";
import FieldTotalsCard from "../../components/time/FieldTotalsCard";
import { styles } from "./TimeEntryDetails.styles";

const TimeEntryDetails = ({ route, navigation }) => {
	// Extract params - handle both single ID and array of IDs
	const { entryId, userId: passedUserId } = route.params;
	const entryIdArray = Array.isArray(entryId) ? entryId : [entryId];

	console.log("Entry IDs:", entryIdArray);

	const insets = useSafeAreaInsets();
	const { userId: currentUserId, companyId, isAdmin } = useUser();
	const { byUserId: membersById } = useCompanyMembers(companyId ?? "");

	// Core state
	const [isLoading, setIsLoading] = useState(true);
	const [timeEntries, setTimeEntries] = useState([]);
	/*
	 * DERIVED, not stored.
	 *
	 * This used to be state written during loadTimeEntries — which runs before
	 * the membership subscription resolves, so it captured an empty map and
	 * never recomputed. The name rendered as "Unknown" forever. Deriving it
	 * means it fills in as soon as members arrive.
	 */
	const employeeUser = useMemo(() => {
		const entryUserId = timeEntries[0]?.userId || passedUserId;
		return entryUserId ? (membersById[entryUserId] ?? null) : null;
	}, [timeEntries, passedUserId, membersById]);
	const [connectedEvents, setConnectedEvents] = useState({});
	// entryId -> { timeEntrySchema, eventSchema }, resolved from formSchemaIds.
	const [schemasByEntry, setSchemasByEntry] = useState({});
	const [attachmentMap, setAttachmentsMap] = useState({});

	// Calculations
	const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
	const [totalDurationDecimal, setTotalDurationDecimal] = useState(0);

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
				entryIdArray.map((id) => getTimeEntry(id)),
			);
			const validEntries = entries.filter((entry) => entry);
			setTimeEntries(validEntries);

			// Fetch attachments
			const attachments = {};
			await Promise.all(
				validEntries.map(async (entry) => {
					try {
						const entryAttachments = await getAttachmentsForParent(
							companyId,
							"timeEntry",
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
				(sum, entry) => sum + (entry.workedSeconds || 0),
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

			/*
			 * Connections are their own documents now (a `connections`
			 * subcollection per entry) rather than v1's embedded
			 * `connectedEvents` array, so they need a read per entry.
			 *
			 * This branch used to be `if (false)`, leaving every entry with an
			 * empty list — connected events never rendered at all.
			 */
			const connectionLists = await Promise.all(
				validEntries.map((entry) => getConnections(entry.id)),
			);

			const entryConnectionMap = {};
			validEntries.forEach((entry, i) => {
				entryConnectionMap[entry.id] = connectionLists[i].map(
					(connection) => ({
						...connection,
						title:
							connection.customTitle ||
							connection.eventTitleSnapshot ||
							"Connected Event",
						formResponses: connection.formResponses || {},
					}),
				);
			});

			setConnectedEvents(entryConnectionMap);

			/*
			 * Form schemas are references now, not the two full copies v1
			 * embedded on every entry, so the totals need them resolved.
			 * getSchema memoizes, so entries sharing a schema cost one read.
			 */
			const schemaMap = {};
			await Promise.all(
				validEntries.map(async (entry) => {
					const [timeEntrySchema, eventSchema] = await Promise.all([
						entry.formSchemaIds?.timeEntry
							? getSchema(entry.formSchemaIds.timeEntry)
							: null,
						entry.formSchemaIds?.event
							? getSchema(entry.formSchemaIds.event)
							: null,
					]);
					schemaMap[entry.id] = { timeEntrySchema, eventSchema };
				}),
			);
			setSchemasByEntry(schemaMap);
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

	/*
	 * Derived, not stored. This used to be computed twice — once inside
	 * loadTimeEntries and again in an effect on `timeEntries` that overwrote
	 * it — so the first result was always discarded.
	 */
	const fieldTotals = useMemo(
		() =>
			calculateFieldTotals(
				timeEntries.map((entry) => ({
					formResponses: entry.formResponses,
					timeEntrySchema: schemasByEntry[entry.id]?.timeEntrySchema,
					eventSchema: schemasByEntry[entry.id]?.eventSchema,
					connections: connectedEvents[entry.id],
				})),
			),
		[timeEntries, schemasByEntry, connectedEvents],
	);

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

			/*
			 * v1 wrote { status: "approved", rejectedAt, rejectedBy } here.
			 * approvedBy/approvedAt were never written by any code path, which
			 * is why 2,104 of 2,116 approved entries carry a corrupt approver.
			 *
			 * Recording the decision now lives in the service, batched, and
			 * stamps review.provenance = "trusted".
			 */
			await approveEntries(entryIds, currentUserId);

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

							await rejectEntries(entryIds, currentUserId, "");

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

	/*
	 * Applies an edit from the sheet.
	 *
	 * Three separate concerns, three separate writes: the entry patch, its
	 * connections, and ONE audit record. v1 merged all three into a single
	 * whole-document write that also appended to an unbounded array.
	 */
	const saveEditedEntry = async (updates: any) => {
		if (!currentEditEntry) return;

		try {
			await updateTimeEntry(currentEditEntry.id, {
				...updates.patch,
				status: "edited",
			});

			if (updates.connections?.length) {
				await setConnections(
					companyId,
					currentEditEntry.id,
					updates.connections,
				);
			}

			await appendEdit(companyId, currentEditEntry.id, updates.edit);

			setEditModalVisible(false);
			await loadTimeEntries();

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
								currentEditEntry.id,
								companyId,
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
				await updateTimeEntry(entryId, {
					formResponses: updatedFormResponses,
				});

				/*
				 * The audit record is its own document now. v1 appended to an
				 * `editHistory` array — a read-modify-write that lost entries
				 * under concurrency, in one of THREE shapes, none of which the
				 * renderer actually read.
				 */
				await appendEdit(companyId, entryId, {
					summary: `Updated field: ${fieldId}`,
					actorUserId: currentUserId,
					actorDisplayName:
						membersById[currentUserId]?.displayName ?? "",
				});
			}
			// For connected event fields
			else {
				const [connectionId, eventFieldId] = fieldId.split("_");

				/*
				 * Connections are their own documents now, so one field change
				 * is one targeted write. v1 rebuilt the entire connectedEvents
				 * array on the parent entry.
				 */
				const connections = await getConnections(entryId);
				const connection = connections.find(
					(c) => c.id === connectionId,
				);
				if (!connection) {
					throw new Error("Connected event not found");
				}

				await updateConnectionResponses(entryId, connectionId, {
					...(connection.formResponses ?? {}),
					[eventFieldId]: value,
				});

				await appendEdit(companyId, entryId, {
					summary: `Updated event field: ${eventFieldId}`,
					actorUserId: currentUserId,
					actorDisplayName:
						membersById[currentUserId]?.displayName ?? "",
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
			/>
		</View>
	);
};

export default TimeEntryDetails;
