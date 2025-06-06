import React, { forwardRef, useCallback, useState, useMemo } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	Alert,
} from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { format } from "date-fns";
import {
	exportTimeEntriesToCSV,
	exportTimeEntriesToPDF,
	shareFile,
} from "../../services/exportService";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// Export format options
const EXPORT_FORMAT_CSV = "csv";
const EXPORT_FORMAT_PDF = "pdf";
const EXPORT_FORMAT_EXCEL = "excel";

interface ExportSheetProps {
	visible: boolean;
	snapPoints: string[];
	onClose: () => void;
	selectedEntries: string[];
	timeEntries: any[];
	employeeUser: any;
	companyId: string;
}

const ExportSheet = forwardRef<BottomSheet, ExportSheetProps>((props, ref) => {
	const {
		visible,
		snapPoints,
		onClose,
		selectedEntries,
		timeEntries,
		employeeUser,
		companyId,
	} = props;

	const [exportFormat, setExportFormat] = useState(EXPORT_FORMAT_PDF);
	const [isExporting, setIsExporting] = useState(false);

	// Filter time entries to only include selected ones
	const selectedTimeEntries = useMemo(() => {
		if (!selectedEntries || selectedEntries.length === 0) {
			return timeEntries;
		}
		return timeEntries.filter((entry) =>
			selectedEntries.includes(entry.id),
		);
	}, [timeEntries, selectedEntries]);

	// Calculate total hours for selected entries
	const totalHours = useMemo(() => {
		return (
			selectedTimeEntries.reduce(
				(sum, entry) => sum + (entry.duration || 0),
				0,
			) / 3600
		);
	}, [selectedTimeEntries]);

	// Export handling
	const handleExport = useCallback(async () => {
		if (selectedTimeEntries.length === 0) {
			Alert.alert(
				"No Entries",
				"Please select at least one time entry to export",
			);
			return;
		}

		setIsExporting(true);

		try {
			let filePath = "";
			const fileName = `TimeEntries_${
				employeeUser?.lastName || "Unknown"
			}_${format(new Date(), "yyyyMMdd")}`;

			if (exportFormat === EXPORT_FORMAT_CSV) {
				filePath = await exportTimeEntriesToCSV(
					selectedTimeEntries,
					fileName,
				);
			} else if (exportFormat === EXPORT_FORMAT_PDF) {
				filePath = await exportTimeEntriesToPDF(
					selectedTimeEntries,
					employeeUser,
					companyId,
					fileName,
				);
			} else if (exportFormat === EXPORT_FORMAT_EXCEL) {
				// This would use a similar function for Excel
				filePath = await exportTimeEntriesToCSV(
					selectedTimeEntries,
					fileName,
					true, // excel format
				);
			}

			if (filePath) {
				await shareFile(filePath);
				onClose();
			}
		} catch (error) {
			console.error("Export error:", error);
			Alert.alert(
				"Export Failed",
				"There was an error exporting the time entries.",
			);
		} finally {
			setIsExporting(false);
		}
	}, [exportFormat, selectedTimeEntries, employeeUser, companyId, onClose]);

	return (
		<BottomSheet
			ref={ref}
			index={-1}
			snapPoints={snapPoints}
			enablePanDownToClose
			backgroundStyle={styles.sheetBackground}
			handleIndicatorStyle={styles.sheetIndicator}
			onClose={onClose}
		>
			<View style={styles.sheetContent}>
				<Text style={styles.modalTitle}>Export Time Entries</Text>

				{/* Summary of what's being exported */}
				<View style={styles.exportSummary}>
					<Text style={styles.summaryText}>
						Exporting {selectedTimeEntries.length}{" "}
						{selectedTimeEntries.length === 1 ? "entry" : "entries"}
						{employeeUser
							? ` for ${employeeUser.firstName} ${employeeUser.lastName}`
							: ""}
					</Text>
					<Text style={styles.summaryText}>
						Total hours: {totalHours.toFixed(2)}
					</Text>

					{selectedTimeEntries.length > 0 && (
						<Text style={styles.dateRangeText}>
							{format(
								new Date(selectedTimeEntries[0].clockInTime),
								"MMM d, yyyy",
							)}
							{selectedTimeEntries.length > 1 &&
								selectedTimeEntries[0].clockInTime !==
									selectedTimeEntries[
										selectedTimeEntries.length - 1
									].clockInTime &&
								` - ${format(
									new Date(
										selectedTimeEntries[
											selectedTimeEntries.length - 1
										].clockInTime,
									),
									"MMM d, yyyy",
								)}`}
						</Text>
					)}
				</View>

				{/* Export format selection */}
				<View style={styles.exportOptionRow}>
					<Text style={styles.exportOptionLabel}>Format:</Text>
					<View style={styles.exportOptions}>
						<TouchableOpacity
							style={[
								styles.exportOption,
								exportFormat === EXPORT_FORMAT_PDF &&
									styles.selectedExportOption,
							]}
							onPress={() => setExportFormat(EXPORT_FORMAT_PDF)}
						>
							<Icon
								name="file-pdf-box"
								size={24}
								color={
									exportFormat === EXPORT_FORMAT_PDF
										? "#007AFF"
										: "#666"
								}
							/>
							<Text
								style={[
									styles.exportOptionText,
									exportFormat === EXPORT_FORMAT_PDF &&
										styles.selectedExportOptionText,
								]}
							>
								PDF
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.exportOption,
								exportFormat === EXPORT_FORMAT_CSV &&
									styles.selectedExportOption,
							]}
							onPress={() => setExportFormat(EXPORT_FORMAT_CSV)}
						>
							<Icon
								name="file-delimited"
								size={24}
								color={
									exportFormat === EXPORT_FORMAT_CSV
										? "#007AFF"
										: "#666"
								}
							/>
							<Text
								style={[
									styles.exportOptionText,
									exportFormat === EXPORT_FORMAT_CSV &&
										styles.selectedExportOptionText,
								]}
							>
								CSV
							</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={[
								styles.exportOption,
								exportFormat === EXPORT_FORMAT_EXCEL &&
									styles.selectedExportOption,
							]}
							onPress={() => setExportFormat(EXPORT_FORMAT_EXCEL)}
						>
							<Icon
								name="microsoft-excel"
								size={24}
								color={
									exportFormat === EXPORT_FORMAT_EXCEL
										? "#007AFF"
										: "#666"
								}
							/>
							<Text
								style={[
									styles.exportOptionText,
									exportFormat === EXPORT_FORMAT_EXCEL &&
										styles.selectedExportOptionText,
								]}
							>
								Excel
							</Text>
						</TouchableOpacity>
					</View>
				</View>

				{/* Action buttons */}
				<View style={styles.modalButtons}>
					<TouchableOpacity
						style={[styles.modalButton, styles.modalCancelButton]}
						onPress={onClose}
						disabled={isExporting}
					>
						<Text style={styles.modalCancelButtonText}>Cancel</Text>
					</TouchableOpacity>

					<TouchableOpacity
						style={[
							styles.modalButton,
							styles.modalExportButton,
							isExporting && styles.disabledButton,
						]}
						onPress={handleExport}
						disabled={isExporting}
					>
						{isExporting ? (
							<ActivityIndicator size="small" color="#fff" />
						) : (
							<Text style={styles.modalExportButtonText}>
								Export
							</Text>
						)}
					</TouchableOpacity>
				</View>
			</View>
		</BottomSheet>
	);
});

const styles = StyleSheet.create({
	sheetBackground: {
		backgroundColor: "white",
	},
	sheetIndicator: {
		backgroundColor: "#ccc",
		width: 40,
		height: 4,
	},
	sheetContent: {
		padding: 20,
		paddingBottom: 40,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		marginBottom: 16,
		textAlign: "center",
	},
	exportSummary: {
		backgroundColor: "#f8f9fa",
		padding: 16,
		borderRadius: 8,
		marginBottom: 20,
	},
	summaryText: {
		fontSize: 15,
		color: "#333",
		marginBottom: 4,
	},
	dateRangeText: {
		fontSize: 14,
		color: "#666",
		marginTop: 4,
	},
	exportOptionRow: {
		marginBottom: 20,
	},
	exportOptionLabel: {
		fontSize: 16,
		fontWeight: "500",
		color: "#333",
		marginBottom: 8,
	},
	exportOptions: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 8,
	},
	exportOption: {
		flex: 1,
		paddingVertical: 12,
		alignItems: "center",
		borderWidth: 1,
		borderColor: "#ddd",
		marginHorizontal: 4,
		borderRadius: 8,
	},
	selectedExportOption: {
		borderColor: "#007AFF",
		backgroundColor: "#f0f7ff",
	},
	exportOptionText: {
		fontSize: 14,
		color: "#666",
		marginTop: 4,
	},
	selectedExportOptionText: {
		color: "#007AFF",
		fontWeight: "500",
	},
	modalButtons: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 16,
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
	modalExportButton: {
		backgroundColor: "#007AFF",
		marginLeft: 8,
	},
	modalCancelButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#666",
	},
	modalExportButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#fff",
	},
	disabledButton: {
		opacity: 0.5,
	},
});

export default ExportSheet;
