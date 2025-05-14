import React, { useState, useEffect, useRef, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	ActivityIndicator,
	Alert,
	Platform,
	Share,
	TextInput,
	Switch,
	Dimensions,
	Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format } from "date-fns";
import { useUser } from "../../contexts/UserContext";
import {
	getTimeEntry,
	updateTimeEntry,
	approveTimeEntry,
	exportTimeEntries,
} from "../../services/timeEntryService";
import { getUser } from "../../services/userService";
import { getCompanyPreferences } from "../../services/companyService";
import { getEventsByIds } from "../../services/eventService";
import * as MailComposer from "expo-mail-composer";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import EditSheet from "../../components/time/EditSheet";
import { useCompany } from "../../contexts/CompanyContext";

// Add this helper function near the top of the component
const calculateMultipliedValue = (value, multiplier) => {
	if (!value || !multiplier) return null;

	const numValue = parseFloat(value);
	if (isNaN(numValue)) return null;

	const result = numValue * multiplier;
	return result % 1 !== 0 ? result.toFixed(2) : result.toString();
};

// Define the structure of individual total items
interface TotalItem {
	value: number;
	label: string;
	unit?: string;
	multiplier?: number | null;
}

interface Totals {
	[key: string]: TotalItem;
}

const TimeEntryDetails = ({ route, navigation }) => {
	// Extract params - handle both single ID and array of IDs
	const { entryId, userId: passedUserId } = route.params;

	const entryIdArray = Array.isArray(entryId) ? entryId : [entryId];

	const insets = useSafeAreaInsets();
	const {
		userId: currentUserId,
		companyId,
		userPrivilege: role,
		isAdmin,
	} = useUser();

	const { preferences, companyData } = useCompany();

	// State variables
	const [isLoading, setIsLoading] = useState(true);
	const [timeEntries, setTimeEntries] = useState([]);
	const [employeeUser, setEmployeeUser] = useState(null);
	const [customForm, setCustomForm] = useState(null);
	const [connectedEvents, setConnectedEvents] = useState([]);
	const [totalDurationSeconds, setTotalDurationSeconds] = useState(0);
	const [totalDurationDecimal, setTotalDurationDecimal] = useState(0);
	const [isApproving, setIsApproving] = useState(false);
	const [isExporting, setIsExporting] = useState(false);
	const [selectedEntries, setSelectedEntries] = useState({});
	const [editModalVisible, setEditModalVisible] = useState(false);
	const [currentEditEntry, setCurrentEditEntry] = useState(null);
	const [editNotes, setEditNotes] = useState("");
	const [editDuration, setEditDuration] = useState("");
	const [editChangeSummary, setEditChangeSummary] = useState("");

	// Check if current user is a manager or admin

	// For bulk selection logic
	const [selectAll, setSelectAll] = useState(false);

	// Export options
	const [exportFormat, setExportFormat] = useState("txt");
	const [exportModalVisible, setExportModalVisible] = useState(false);

	// Bottom sheet refs
	const editBottomSheetRef = useRef(null);
	const exportBottomSheetRef = useRef(null);

	// Bottom sheet snap points
	const editSnapPoints = useRef(["90%"]).current;
	const exportSnapPoints = useRef(["40%"]).current;

	useEffect(() => {
		loadTimeEntries();
	}, []);

	// Control bottom sheet visibility
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

	// Load all relevant data
	const loadTimeEntries = async () => {
		try {
			setIsLoading(true);

			// Fetch all time entries
			const entries = await Promise.all(
				entryIdArray.map((id) => getTimeEntry(companyId, id)),
			);

			// Filter out any null/undefined entries
			const validEntries = entries.filter((entry) => entry);
			setTimeEntries(validEntries);

			// Calculate total duration
			const totalSeconds = validEntries.reduce(
				(sum, entry) => sum + (entry.duration || 0),
				0,
			);
			setTotalDurationSeconds(totalSeconds);

			// Convert to decimal hours (2 decimal places)
			const decimalHours = +(totalSeconds / 3600).toFixed(2);
			setTotalDurationDecimal(decimalHours);

			// Initialize selection state for each entry
			const initialSelection = {};
			validEntries.forEach((entry) => {
				initialSelection[entry.id] = false;
			});
			setSelectedEntries(initialSelection);

			// Get employee user info
			const userId = validEntries[0]?.userId || passedUserId;
			if (userId) {
				const user = await getUser(userId);
				setEmployeeUser(user);
			}

			// Get custom form if applicable
			if (validEntries.length > 0 && validEntries[0].formResponses) {
				const preferences = await getCompanyPreferences(companyId);
				if (preferences?.timeEntryForm) {
					setCustomForm(preferences.timeEntryForm);
				}
			}

			// Get all connected events
			const allEventIds = validEntries.reduce((acc, entry) => {
				if (entry.connectedEvents && entry.connectedEvents.length > 0) {
					return [
						...acc,
						...entry.connectedEvents.map((e) => e.eventId),
					];
				}
				return acc;
			}, []);

			if (allEventIds.length > 0) {
				const events = await getEventsByIds(companyId, allEventIds);
				setConnectedEvents(events);
			}
		} catch (error) {
			console.error("Error loading time entry details:", error);
			Alert.alert("Error", "Failed to load time entry details");
		} finally {
			setIsLoading(false);
		}
	};

	// Make sure the function is properly typed to return Totals
	const calculateNumberFieldTotals = (): Totals => {
		const totals: Totals = {}; // Initialize with proper type

		// Skip if no entries or no custom form
		if (!timeEntries?.length || !customForm?.fields) return totals;

		// Find all number fields that should show totals
		const totalableFields = customForm.fields.filter(
			(field) => field.type === "number" && field.showTotal === true,
		);

		// Skip if no totalable fields
		if (!totalableFields.length) return totals;

		// Sum up values across all entries
		timeEntries.forEach((entry) => {
			if (entry.formResponses) {
				totalableFields.forEach((field) => {
					const value = entry.formResponses[field.id];
					if (value && !isNaN(parseFloat(value))) {
						const numValue = parseFloat(value);

						// Initialize if not exists
						if (!totals[field.id]) {
							totals[field.id] = {
								value: 0,
								label: field.label,
								unit: field.unit || "",
								multiplier: field.useMultiplier
									? field.multiplier
									: null,
							};
						}
						totals[field.id].value += numValue;
					}
				});
			}
		});

		return totals;
	};

	// Get status badge color
	const getStatusBadgeColor = (status) => {
		switch (status) {
			case "approved":
				return "#d4edda"; // Green
			case "pending_approval":
				return "#fff3cd"; // Orange
			case "edited":
				return "#cce5ff"; // Yellow
			case "active":
				return "#d1ecf1"; // Blue
			case "paused":
				return "#fff3cd"; // Orange
			case "rejected":
				return "#f8d7da"; // Red
			default:
				return "#f8d7da"; // Grey
		}
	};

	// Get status badge text
	const getStatusBadgeText = (status) => {
		switch (status) {
			case "approved":
				return "Approved";
			case "pending_approval":
				return "Pending Approval";
			case "edited":
				return "Edited";
			case "active":
				return "Active";
			case "paused":
				return "Paused";
			case "rejected":
				return "Rejected";
			default:
				return "Not Submitted";
		}
	};

	// Format time duration for display
	const formatDuration = (seconds) => {
		if (!seconds) return "0h 0m";

		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	};

	// Toggle selection for a specific entry
	const toggleEntrySelection = (entryId) => {
		setSelectedEntries((prev) => ({
			...prev,
			[entryId]: !prev[entryId],
		}));
	};

	// Toggle select all entries
	const toggleSelectAll = () => {
		const newValue = !selectAll;
		setSelectAll(newValue);

		const updatedSelection = {};
		timeEntries.forEach((entry) => {
			updatedSelection[entry.id] = newValue;
		});
		setSelectedEntries(updatedSelection);
	};

	// Get IDs of selected entries
	const getSelectedEntryIds = () => {
		return Object.keys(selectedEntries).filter((id) => selectedEntries[id]);
	};

	// Approve selected entries
	const handleApproveEntries = async () => {
		const selectedIds = getSelectedEntryIds();
		if (selectedIds.length === 0) {
			Alert.alert(
				"Selection Required",
				"Please select at least one entry to approve.",
			);
			return;
		}

		try {
			setIsApproving(true);

			await Promise.all(
				selectedIds.map((id) =>
					approveTimeEntry(id, companyId, {
						status: "approved",
						approvedBy: currentUserId,
						approvedAt: new Date().toISOString(),
					}),
				),
			);

			Alert.alert(
				"Success",
				`${selectedIds.length} time ${
					selectedIds.length > 1 ? "entries" : "entry"
				} approved.`,
				[
					{
						text: "OK",
						onPress: () => {
							// Send approval email automatically
							handleEmailEmployee(selectedIds, "approved");
							loadTimeEntries();
							setSelectAll(false);
						},
					},
				],
			);
		} catch (error) {
			console.error("Error approving time entries:", error);
			Alert.alert("Error", "Failed to approve selected time entries");
		} finally {
			setIsApproving(false);
		}
	};

	// Add this new function after handleApproveEntries
	const handleRejectEntries = async () => {
		const selectedIds = getSelectedEntryIds();
		if (selectedIds.length === 0) {
			Alert.alert(
				"Selection Required",
				"Please select at least one entry to reject.",
			);
			return;
		}

		// Ask for rejection reason
		Alert.prompt(
			"Rejection Reason",
			"Please provide a reason for rejecting these entries:",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Reject",
					onPress: async (rejectionReason) => {
						try {
							setIsApproving(true); // Reuse the loading indicator

							await Promise.all(
								selectedIds.map((id) =>
									updateTimeEntry(id, companyId, {
										status: "rejected",
										rejectedBy: currentUserId,
										rejectedAt: new Date().toISOString(),
										rejectionReason:
											rejectionReason ||
											"No reason provided",
									}),
								),
							);

							Alert.alert(
								"Success",
								`${selectedIds.length} time ${
									selectedIds.length > 1 ? "entries" : "entry"
								} rejected.`,
								[
									{
										text: "OK",
										onPress: () => {
											// Send rejection email automatically
											handleEmailEmployee(
												selectedIds,
												"rejected",
												rejectionReason,
											);
											loadTimeEntries();
											setSelectAll(false);
										},
									},
								],
							);
						} catch (error) {
							console.error(
								"Error rejecting time entries:",
								error,
							);
							Alert.alert(
								"Error",
								"Failed to reject selected time entries",
							);
						} finally {
							setIsApproving(false);
						}
					},
				},
			],
			"plain-text",
		);
	};

	// Handle exporting time entries
	const handleExport = () => {
		setExportModalVisible(true);
	};

	// Export the selected time entries
	const exportSelectedEntries = async () => {
		const selectedIds = getSelectedEntryIds();
		if (selectedIds.length === 0) {
			Alert.alert(
				"Selection Required",
				"Please select at least one entry to export.",
			);
			return;
		}

		// Get the actual entry objects that match the selected IDs
		const selectedEntries = timeEntries.filter((entry) =>
			selectedIds.includes(entry.id),
		);

		// Now pass the entry objects to createFormFieldMap
		const formresponses = createFormFieldMap(selectedEntries);

		try {
			setIsExporting(true);

			const fileUri = await exportTimeEntries(
				companyId,
				selectedIds,
				exportFormat,
				employeeUser?.firstName + " " + employeeUser?.lastName ||
					"Employee",
				formresponses,
			);

			if (fileUri) {
				if (Platform.OS === "ios") {
					await Sharing.shareAsync(fileUri);
				} else {
					const shareResult = await Share.share({
						url: "file://" + fileUri,
						title: `Time Entries - ${
							employeeUser?.firstName +
								" " +
								employeeUser?.lastName || "Employee"
						}`,
					});
				}
			}
		} catch (error) {
			console.error("Error exporting time entries:", error);
			Alert.alert("Error", "Failed to export time entries");
		} finally {
			setIsExporting(false);
			setExportModalVisible(false);
		}
	};

	// Update email function to handle both approve and reject cases
	const handleEmailEmployee = async (
		entryIds = null,
		status = "approved",
		rejectionReason = null,
	) => {
		const idsToEmail = entryIds || getSelectedEntryIds();
		if (idsToEmail.length === 0) {
			Alert.alert(
				"Selection Required",
				"Please select at least one entry.",
			);
			return;
		}

		if (!employeeUser || !employeeUser.email) {
			Alert.alert("Error", "Employee email not found");
			return;
		}

		try {
			const entries = idsToEmail
				.map((id) => timeEntries.find((entry) => entry.id === id))
				.filter((entry) => entry);

			const totalHours = +(
				entries.reduce((sum, entry) => sum + (entry.duration || 0), 0) /
				3600
			).toFixed(2);

			const dateRanges = entries
				.map((entry) =>
					format(new Date(entry.clockInTime), "MMM d, yyyy"),
				)
				.filter((date, index, self) => self.indexOf(date) === index);

			// Build entry list for email including connected events
			let entryList = "";
			entries.forEach((entry) => {
				entryList += `- ${format(
					new Date(entry.clockInTime),
					"EEE, MMM d, yyyy",
				)} (${format(new Date(entry.clockInTime), "h:mm a")} - ${
					entry.clockOutTime
						? format(new Date(entry.clockOutTime), "h:mm a")
						: "N/A"
				})\n`;
				entryList += `  Duration: ${formatDuration(entry.duration)} (${(
					entry.duration / 3600
				).toFixed(2)} hrs)\n`;

				// Add entry notes if available
				if (entry.notes) {
					entryList += `  Notes: ${entry.notes}\n`;
				}

				// Add connected events if available
				if (entry.connectedEvents && entry.connectedEvents.length > 0) {
					entryList += `  Events:\n`;
					entry.connectedEvents.forEach((connEvent) => {
						// Get event details
						const fullEvent = getEventById(connEvent.eventId);
						const eventTitle =
							connEvent.eventTitle ||
							fullEvent?.title ||
							"Unknown Event";

						entryList += `    • ${eventTitle}\n`;

						// Add time if available
						if (fullEvent?.startTime) {
							entryList += `      ${format(
								new Date(fullEvent.startTime),
								"h:mm a",
							)}`;
							if (fullEvent.endTime) {
								entryList += ` - ${format(
									new Date(fullEvent.endTime),
									"h:mm a",
								)}`;
							}
							entryList += `\n`;
						}

						// Add location if available
						if (fullEvent?.location) {
							entryList += `      Location: ${fullEvent.location}\n`;
						}
					});
				}

				entryList += "\n";
			});

			// Build summary of number field totals
			let fieldTotals = "";
			const totals = calculateNumberFieldTotals();
			Object.values(totals).forEach((total) => {
				const hasMultiplier =
					total.multiplier && !isNaN(total.multiplier);
				const multipliedValue = hasMultiplier
					? total.value * total.multiplier
					: null;

				fieldTotals += `- ${total.label}: ${total.value.toFixed(2)}`;
				if (hasMultiplier) {
					fieldTotals += ` (${multipliedValue.toFixed(2)}${
						total.unit ? ` ${total.unit}` : ""
					})`;
				} else if (total.unit) {
					fieldTotals += ` ${total.unit}`;
				}
				fieldTotals += "\n";
			});

			// Set subject and message based on status
			const subject =
				status === "approved"
					? `Time Entries Approved - ${dateRanges.join(", ")}`
					: `Time Entries Rejected - ${dateRanges.join(", ")}`;

			let message = `
Dear ${employeeUser.firstName + " " + employeeUser.lastName},

Your time entries for ${dateRanges.join(", ")} have been ${status}.
`;

			// Add rejection reason if applicable
			if (status === "rejected" && rejectionReason) {
				message += `
Reason for rejection: ${rejectionReason}
`;
			}

			message += `
--- SUMMARY ---
Total hours: ${totalHours}
Total duration: ${formatDuration(totalDurationSeconds)}

${fieldTotals ? `--- FIELD TOTALS ---\n${fieldTotals}` : ""}

--- ${status.toUpperCase()} ENTRIES ---
${entryList}

${
	status === "approved"
		? "Thank you for your work!"
		: "Please review and resubmit these entries."
}

Best regards,
${companyData.name || "Management"}
    `;

			// Check if email is available
			const isAvailable = await MailComposer.isAvailableAsync();
			if (!isAvailable) {
				Alert.alert(
					"Info",
					`Email is not available. Email would contain:\n\nSubject: ${subject}`,
				);
				console.log(message);
				return;
			}

			await MailComposer.composeAsync({
				recipients: [employeeUser.email],
				subject: subject,
				body: message,
			});
		} catch (error) {
			console.error("Error sending email:", error);
			Alert.alert("Error", "Failed to send email");
		}
	};

	// Open edit modal for a specific entry
	const handleEditEntry = (entry) => {
		setCurrentEditEntry(entry);
		setEditNotes(entry.notes || "");
		setEditDuration(entry.duration ? String(entry.duration) : "");
		setEditChangeSummary("");
		setEditModalVisible(true);
	};

	// Save edited entry
	const saveEditedEntry = async (updates) => {
		if (!currentEditEntry) return;

		try {
			await updateTimeEntry(currentEditEntry.id, companyId, updates);

			Alert.alert("Success", "Time entry updated successfully", [
				{ text: "OK", onPress: () => loadTimeEntries() },
			]);

			setEditModalVisible(false);
		} catch (error) {
			console.error("Error updating time entry:", error);
			Alert.alert("Error", "Failed to update time entry");
		}
	};

	const createFormFieldMap = (entries) => {
		// If no entries or no custom form, return empty object
		if (!entries.length || !customForm) return {};

		// Create a map where entry IDs are keys and values are objects of form responses
		const formFieldMap = {};

		entries.forEach((entry) => {
			if (!entry.formResponses) return;

			// Initialize object for this entry if not exists
			if (!formFieldMap[entry.id]) {
				formFieldMap[entry.id] = {};
			}

			// Process each field in the custom form
			customForm.fields.forEach((field) => {
				const response = entry.formResponses[field.id];

				// Skip if there's no response for this field
				if (response === undefined || response === null) return;

				// Format the response based on field type
				let formattedResponse = response;

				if (field.type === "checkbox") {
					formattedResponse = response ? "Yes" : "No";
				} else if (
					field.type === "multiSelect" &&
					Array.isArray(response)
				) {
					formattedResponse =
						response.length > 0 ? response.join(", ") : "N/A";
				} else if (field.type === "date" && response) {
					formattedResponse = format(
						new Date(response),
						"MMM d, yyyy",
					);
				} else if (field.type === "time" && response) {
					formattedResponse = format(new Date(response), "h:mm a");
				}

				// Store in map with field label as key under the entry's object
				formFieldMap[entry.id][field.label] = formattedResponse;
			});
		});

		return formFieldMap;
	};

	// Handlers for bottom sheets
	const handleEditSheetClose = useCallback(() => {
		setEditModalVisible(false);
		Keyboard?.dismiss();
	}, []);

	const handleExportSheetClose = useCallback(() => {
		setExportModalVisible(false);
	}, []);

	// Get event details by ID
	const getEventById = (eventId) => {
		return connectedEvents.find((event) => event.id === eventId) || null;
	};

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
						onPress={handleExport}
						disabled={isExporting}
					>
						<Icon name="export-variant" size={24} color="#007AFF" />
					</TouchableOpacity>
				)}
			</View>

			<ScrollView style={styles.scrollContainer}>
				{/* Summary Card */}
				<View style={styles.summaryCard}>
					{/* Existing summary rows remain the same */}
					<View style={styles.summaryRow}>
						<Text style={styles.summaryLabel}>Employee:</Text>
						<Text style={styles.summaryValue}>
							{employeeUser?.firstName +
								" " +
								employeeUser?.lastName || "Unknown"}
						</Text>
					</View>

					<View style={styles.summaryRow}>
						<Text style={styles.summaryLabel}>Total Duration:</Text>
						<Text style={styles.summaryValue}>
							{formatDuration(totalDurationSeconds)} (
							{totalDurationDecimal} hrs)
						</Text>
					</View>

					<View style={styles.summaryRow}>
						<Text style={styles.summaryLabel}>Status:</Text>
						<View style={styles.statusContainer}>
							{timeEntries.length === 1 ? (
								<View
									style={[
										styles.statusBadge,
										{
											backgroundColor:
												getStatusBadgeColor(
													timeEntries[0].status,
												),
										},
									]}
								>
									<Text style={styles.statusText}>
										{getStatusBadgeText(
											timeEntries[0].status,
										)}
									</Text>
								</View>
							) : (
								<Text style={styles.statusText}>Multiple</Text>
							)}
						</View>
					</View>

					<View style={styles.summaryRow}>
						<Text style={styles.summaryLabel}>Date Range:</Text>
						<Text style={styles.summaryValue}>
							{timeEntries.length > 0
								? `${format(
										new Date(timeEntries[0].clockInTime),
										"MMM d, yyyy",
									)}
                  ${
						timeEntries.length > 1
							? " - " +
								format(
									new Date(
										timeEntries[
											timeEntries.length - 1
										].clockInTime,
									),
									"MMM d, yyyy",
								)
							: ""
					}`
								: "N/A"}
						</Text>
					</View>

					{/* Add Number Field Totals - only show when there are multiple entries */}
					{timeEntries.length > 1 && (
						<>
							{Object.values(calculateNumberFieldTotals()).map(
								(total: TotalItem) => {
									// Calculate multiplied value if applicable
									const hasMultiplier =
										total.multiplier &&
										!isNaN(total.multiplier);
									const multipliedValue = hasMultiplier
										? total.value * total.multiplier
										: null;

									return (
										<View
											key={total.label}
											style={[
												styles.summaryRow,
												styles.totalSummaryRow,
											]}
										>
											<Text style={styles.summaryLabel}>
												{total.label} Total:
											</Text>
											<Text
												style={[
													styles.summaryValue,
													styles.totalValue,
												]}
											>
												{total.value.toFixed(2)}
												{hasMultiplier
													? ` (${multipliedValue.toFixed(
															2,
														)}${
															total.unit
																? ` ${total.unit}`
																: ""
														})`
													: total.unit
														? ` ${total.unit}`
														: ""}
											</Text>
										</View>
									);
								},
							)}
						</>
					)}
				</View>

				{/* Manager Actions */}
				{isAdmin && timeEntries.length > 0 && (
					<View style={styles.managerActionsCard}>
						<View style={styles.selectAllRow}>
							<TouchableOpacity
								onPress={toggleSelectAll}
								style={styles.selectAllButton}
							>
								<Icon
									name={
										selectAll
											? "checkbox-marked"
											: "checkbox-blank-outline"
									}
									size={24}
									color="#007AFF"
								/>
								<Text style={styles.selectAllText}>
									Select All
								</Text>
							</TouchableOpacity>
							<Text style={styles.selectedCountText}>
								{getSelectedEntryIds().length} of{" "}
								{timeEntries.length} selected
							</Text>
						</View>

						<View style={styles.managerButtonRow}>
							<TouchableOpacity
								style={[
									styles.managerActionButton,
									styles.approveButton,
									isApproving && styles.disabledButton,
								]}
								onPress={handleApproveEntries}
								disabled={
									isApproving ||
									getSelectedEntryIds().length === 0
								}
							>
								{isApproving ? (
									<ActivityIndicator
										size="small"
										color="#fff"
									/>
								) : (
									<>
										<Icon
											name="check-circle"
											size={18}
											color="#fff"
										/>
										<Text style={styles.buttonText}>
											Approve
										</Text>
									</>
								)}
							</TouchableOpacity>

							<TouchableOpacity
								style={[
									styles.managerActionButton,
									styles.rejectButton,
									isApproving && styles.disabledButton,
								]}
								onPress={handleRejectEntries}
								disabled={
									isApproving ||
									getSelectedEntryIds().length === 0
								}
							>
								<Icon
									name="close-circle"
									size={18}
									color="#fff"
								/>
								<Text style={styles.buttonText}>Reject</Text>
							</TouchableOpacity>
						</View>
					</View>
				)}

				{/* Time Entries List */}
				{timeEntries.map((entry) => (
					<View key={entry.id} style={styles.timeEntryCard}>
						<View style={styles.timeEntryHeader}>
							<View style={styles.headerLeftSection}>
								{isAdmin && (
									<TouchableOpacity
										style={styles.selectionCheckbox}
										onPress={() =>
											toggleEntrySelection(entry.id)
										}
									>
										<Icon
											name={
												selectedEntries[entry.id]
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
									{
										backgroundColor: getStatusBadgeColor(
											entry.status,
										),
									},
								]}
							>
								<Text style={styles.statusText}>
									{getStatusBadgeText(entry.status)}
								</Text>
							</View>
						</View>

						<View style={styles.timeEntryDetails}>
							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									Clock In:
								</Text>
								<Text style={styles.detailValue}>
									{format(
										new Date(entry.clockInTime),
										"h:mm a",
									)}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									Clock Out:
								</Text>
								<Text style={styles.detailValue}>
									{entry.clockOutTime
										? format(
												new Date(entry.clockOutTime),
												"h:mm a",
											)
										: "N/A"}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Text style={styles.detailLabel}>
									Duration:
								</Text>
								<Text style={styles.detailValue}>
									{entry.duration
										? formatDuration(entry.duration) +
											"(" +
											(entry.duration / 3600).toFixed(2) +
											" hrs)"
										: "N/A"}
								</Text>
							</View>

							{/* Connected Events */}
							{entry.connectedEvents &&
								entry.connectedEvents.length > 0 && (
									<View style={styles.connectedEventsSection}>
										<Text style={styles.sectionTitle}>
											Connected Events
										</Text>
										{entry.connectedEvents.map(
											(connEvent, index) => {
												const fullEvent = getEventById(
													connEvent.eventId,
												);
												return (
													<View
														key={index}
														style={
															styles.connectedEventItem
														}
													>
														<Icon
															name="calendar"
															size={16}
															color="#007AFF"
														/>
														<Text
															style={
																styles.eventTitle
															}
														>
															{connEvent.eventTitle ||
																fullEvent?.title ||
																"Unknown Event"}
														</Text>
													</View>
												);
											},
										)}
									</View>
								)}

							{/* Notes Section */}
							{entry.notes && (
								<View style={styles.notesSection}>
									<Text style={styles.sectionTitle}>
										Notes
									</Text>
									<Text style={styles.notesText}>
										{entry.notes}
									</Text>
								</View>
							)}

							{/* Form Responses */}
							{entry.formResponses && customForm && (
								<View style={styles.formResponsesSection}>
									<Text style={styles.sectionTitle}>
										Form Responses
									</Text>
									{customForm.fields.map((field) => {
										const response =
											entry.formResponses[field.id];

										if (
											response === undefined ||
											response === null
										)
											return null;

										return (
											<View
												key={field.id}
												style={styles.formResponseItem}
											>
												<Text
													style={
														styles.formFieldLabel
													}
												>
													{field.label}
												</Text>
												{field.type === "number" &&
												field.useMultiplier &&
												field.multiplier ? (
													<View>
														<Text
															style={
																styles.formFieldValue
															}
														>
															{response}{" "}
														</Text>
														<Text
															style={
																styles.multiplierValue
															}
														>
															(
															{calculateMultipliedValue(
																response,
																field.multiplier,
															)}{" "}
															{field.unit || ""})
														</Text>
													</View>
												) : field.type ===
												  "checkbox" ? (
													<Text
														style={
															styles.formFieldValue
														}
													>
														{response
															? "Yes"
															: "No"}
													</Text>
												) : field.type ===
												  "multiSelect" ? (
													<Text
														style={
															styles.formFieldValue
														}
													>
														{response.length > 0
															? response.join(
																	", ",
																)
															: "N/A"}
													</Text>
												) : field.type === "date" ? (
													<Text
														style={
															styles.formFieldValue
														}
													>
														{response
															? format(
																	response,
																	"MMM d, yyyy",
																)
															: "N/A"}
													</Text>
												) : field.type === "time" ? (
													<Text
														style={
															styles.formFieldValue
														}
													>
														{response
															? format(
																	response,
																	"h:mm a",
																)
															: "N/A"}
													</Text>
												) : (
													<Text
														style={
															styles.formFieldValue
														}
													>
														{response
															? response
															: "N/A"}
													</Text>
												)}
											</View>
										);
									})}
								</View>
							)}

							{/* Edit History */}
							{entry.editHistory &&
								entry.editHistory.length > 0 && (
									<View style={styles.editHistorySection}>
										<Text style={styles.sectionTitle}>
											Edit History
										</Text>
										{entry.editHistory.map(
											(edit, index) => (
												<View
													key={index}
													style={
														styles.editHistoryItem
													}
												>
													<Text
														style={
															styles.editTimestamp
														}
													>
														{format(
															new Date(
																edit.timestamp,
															),
															"MMM d, yyyy h:mm a",
														)}
													</Text>
													<Text
														style={
															styles.editSummary
														}
													>
														{edit.summary}
													</Text>
												</View>
											),
										)}
									</View>
								)}

							{/* Actions */}
							<View style={styles.entryActions}>
								{(isAdmin ||
									preferences?.allowUserEventEditing) &&
									entry.status !== "approved" && (
										<TouchableOpacity
											style={styles.editButton}
											onPress={() =>
												handleEditEntry(entry)
											}
										>
											<Icon
												name="pencil"
												size={16}
												color="#007AFF"
											/>
											<Text style={styles.editButtonText}>
												Edit
											</Text>
										</TouchableOpacity>
									)}
							</View>
						</View>
					</View>
				))}
			</ScrollView>

			<EditSheet
				ref={editBottomSheetRef}
				visible={editModalVisible}
				snapPoints={editSnapPoints}
				timeEntry={currentEditEntry}
				customForm={customForm}
				editNotes={editNotes}
				editChangeSummary={editChangeSummary}
				setEditNotes={setEditNotes}
				setEditChangeSummary={setEditChangeSummary}
				onClose={handleEditSheetClose}
				onSave={saveEditedEntry}
			/>

			{/* Export Bottom Sheet */}
			<BottomSheet
				ref={exportBottomSheetRef}
				snapPoints={exportSnapPoints}
				enablePanDownToClose={true}
				onClose={handleExportSheetClose}
				backgroundStyle={styles.sheetBackground}
				handleIndicatorStyle={styles.sheetIndicator}
				index={-1}
			>
				<View style={styles.sheetHeader}>
					<Text style={styles.modalTitle}>Export Time Entries</Text>
					<TouchableOpacity
						onPress={() => setExportModalVisible(false)}
					>
						<Icon name="close" size={24} color="#999" />
					</TouchableOpacity>
				</View>

				<BottomSheetScrollView
					contentContainerStyle={styles.sheetContent}
				>
					<View style={styles.exportOptionRow}>
						<Text style={styles.modalLabel}>Export Format:</Text>
						<View style={styles.exportOptions}>
							<TouchableOpacity
								style={[
									styles.exportOption,
									exportFormat === "txt" &&
										styles.selectedExportOption,
								]}
								onPress={() => setExportFormat("txt")}
							>
								<Text
									style={[
										styles.exportOptionText,
										exportFormat === "txt" &&
											styles.selectedExportOptionText,
									]}
								>
									TXT
								</Text>
							</TouchableOpacity>

							<TouchableOpacity
								style={[
									styles.exportOption,
									exportFormat === "csv" &&
										styles.selectedExportOption,
								]}
								onPress={() => setExportFormat("csv")}
							>
								<Text
									style={[
										styles.exportOptionText,
										exportFormat === "csv" &&
											styles.selectedExportOptionText,
									]}
								>
									CSV
								</Text>
							</TouchableOpacity>
						</View>
					</View>

					<View style={styles.modalButtons}>
						<TouchableOpacity
							style={[
								styles.modalButton,
								styles.modalCancelButton,
							]}
							onPress={() => setExportModalVisible(false)}
						>
							<Text style={styles.modalCancelButtonText}>
								Cancel
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[styles.modalButton, styles.modalSaveButton]}
							onPress={exportSelectedEntries}
							disabled={isExporting}
						>
							{isExporting ? (
								<ActivityIndicator size="small" color="#fff" />
							) : (
								<Text style={styles.modalSaveButtonText}>
									Export
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</BottomSheetScrollView>
			</BottomSheet>
		</View>
	);
};

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
	connectedEventItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 6,
		backgroundColor: "#f7f9fc",
		paddingHorizontal: 12,
		borderRadius: 4,
		marginBottom: 8,
	},
	eventTitle: {
		fontSize: 14,
		color: "#333",
		marginLeft: 8,
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
		maxHeight: Dimensions.get("window").height * 0.8,
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
});

export default TimeEntryDetails;
