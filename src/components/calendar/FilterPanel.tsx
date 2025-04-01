// FilterPanel.tsx
// It provides a filter panel for selecting different event filters.
// It uses a bottom sheet to display options for filtering events based on user selection.
// It includes options for filtering by specific users, all events, my events, and unassigned events.
//
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import {
	FilterType,
	ALL,
	MY,
	SPECIFIC,
	UNASSIGNED,
} from "../../types/enums/FilterType";
import BottomSheet from "@gorhom/bottom-sheet";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import { Checkbox } from "../ui/Checkbox";
import { Button } from "../ui/Button";
import { getAllUsersInCompany } from "../../services/companyService";

type FilterPanelProps = {
	filterType: FilterType;
	handleFilterChange: (type: FilterType) => void;
	bottomSheetRef: React.RefObject<BottomSheet>;
	bottomSheetPosition: number;
	handleSheetChanges: (index: number) => void;
	snapPoints: string[];
	selectedUsers: string[];
	setSelectedUsers: React.Dispatch<React.SetStateAction<string[]>>;
	availableWorkers: any[];
	setAvailableWorkers: React.Dispatch<React.SetStateAction<any[]>>;
	openSelect: boolean;
	checkSelectOpen: () => void;
	showAllSelectedOnly: boolean;
	setShowAllSelectedOnly: React.Dispatch<React.SetStateAction<boolean>>;
	showExactSelectedOnly: boolean;
	setShowExactSelectedOnly: React.Dispatch<React.SetStateAction<boolean>>;
	setFilterType: React.Dispatch<React.SetStateAction<FilterType>>;
	isAdmin?: boolean;
	companyId: string;
};

export const FilterPanel: React.FC<FilterPanelProps> = ({
	filterType,
	handleFilterChange,
	bottomSheetRef,
	bottomSheetPosition,
	handleSheetChanges,
	snapPoints,
	selectedUsers,
	setSelectedUsers,
	availableWorkers,
	setAvailableWorkers,
	openSelect,
	checkSelectOpen,
	showAllSelectedOnly,
	setShowAllSelectedOnly,
	showExactSelectedOnly,
	setShowExactSelectedOnly,
	setFilterType,
	isAdmin = false,
	companyId,
}) => {
	useEffect(() => {
		const getWorkers = async () => {
			try {
				const workersData = await getAllUsersInCompany(companyId);

				// Safety check and conversion logic
				let formattedWorkers = [];

				if (workersData) {
					// Handle if workersData is an array
					if (Array.isArray(workersData)) {
						formattedWorkers = workersData.map((worker) => ({
							label: `${worker.firstName || ""} ${
								worker.lastName || ""
							}`.trim(),
							value: worker.id,
						}));
					}
					// Handle if workersData is an object with user data
					else if (typeof workersData === "object") {
						formattedWorkers = Object.keys(workersData).map(
							(key) => {
								const worker = workersData[key];
								return {
									label: `${worker.firstName || ""} ${
										worker.lastName || ""
									}`.trim(),
									value: worker.id || key,
								};
							},
						);
					}
				}

				console.log(`Formatted ${formattedWorkers.length} workers`); // Debug output
				setAvailableWorkers(formattedWorkers);
			} catch (error) {
				console.error("Error fetching workers:", error);
				// Set empty array to prevent further errors
				setAvailableWorkers([]);
			}
		};

		if (companyId) {
			getWorkers();
		}
	}, [companyId]);

	return (
		<BottomSheet
			ref={bottomSheetRef}
			snapPoints={snapPoints}
			onChange={handleSheetChanges}
			enablePanDownToClose={true}
			index={bottomSheetPosition}
		>
			<BottomSheetView style={styles.contentContainer}>
				<View style={styles.bottomSheetHandle} />
				{filterType === SPECIFIC ? (
					<View style={styles.dropdownWrapper}>
						{/* Specific user filter UI */}
						<View style={styles.headerRow}>
							<Button
								title="← Back"
								variant="text"
								onPress={() => {
									setShowAllSelectedOnly(false);
									setShowExactSelectedOnly(false);
									setSelectedUsers([]);
									setFilterType(ALL);
									setTimeout(() => {
										bottomSheetRef.current?.snapToIndex(0);
									}, 100);
								}}
							/>
							<Text style={styles.filterTitle}>Select Users</Text>
						</View>

						<DropDownPicker
							searchPlaceholder="Search"
							multiple={true}
							min={0}
							max={5}
							value={selectedUsers}
							setValue={setSelectedUsers}
							items={availableWorkers}
							setItems={setAvailableWorkers}
							open={openSelect}
							setOpen={checkSelectOpen}
							mode="BADGE"
							listMode="SCROLLVIEW"
							searchable={true}
							maxHeight={200}
							style={styles.dropdown}
							dropDownContainerStyle={styles.dropdownList}
							listItemContainerStyle={styles.dropdownItem}
							zIndex={3000}
							placeholder="Select Users"
						/>

						{selectedUsers.length > 1 && (
							<View style={styles.checkboxContainer}>
								<Checkbox
									checked={showAllSelectedOnly}
									onPress={() => {
										setShowAllSelectedOnly((prev) => !prev);
										if (!showAllSelectedOnly) {
											setShowExactSelectedOnly(false);
										}
									}}
									label="Together"
								/>

								<Checkbox
									checked={showExactSelectedOnly}
									onPress={() => {
										setShowExactSelectedOnly(
											(prev) => !prev,
										);
										if (!showExactSelectedOnly) {
											setShowAllSelectedOnly(false);
										}
									}}
									label="Exclusively Together"
								/>
							</View>
						)}

						<Button
							title="Apply Filter"
							variant="primary"
							fullWidth
							onPress={() => handleFilterChange(SPECIFIC)}
							style={styles.applyButton}
						/>
					</View>
				) : (
					<>
						<Text style={styles.filterTitle}>Event Filters</Text>
						<Button
							title="My Events"
							variant="outline"
							fullWidth
							selected={filterType === MY}
							onPress={() => handleFilterChange(MY)}
							style={styles.filterButton}
						/>

						<Button
							title="Specific Users"
							variant="outline"
							fullWidth
							selected={filterType === SPECIFIC}
							onPress={() => setFilterType(SPECIFIC)}
							style={styles.filterButton}
						/>

						<Button
							title="Unassigned Events"
							variant="outline"
							fullWidth
							selected={filterType === UNASSIGNED}
							onPress={() => handleFilterChange(UNASSIGNED)}
							style={styles.filterButton}
						/>

						<Button
							title="All Events"
							variant="outline"
							fullWidth
							selected={filterType === ALL}
							onPress={() => handleFilterChange(ALL)}
							style={styles.filterButton}
						/>
					</>
				)}
			</BottomSheetView>
		</BottomSheet>
	);
};

const styles = StyleSheet.create({
	// Copy all relevant styles from your original file
	contentContainer: {
		flex: 1,
		padding: 24,
		paddingBottom: 10,
		alignItems: "center",
		minHeight: "100%",
	},
	bottomSheetHandle: {
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#DEDEDE",
		alignSelf: "center",
		marginBottom: 20,
		display: "none",
	},
	dropdownWrapper: {
		width: "100%",
		zIndex: 5000,
		marginBottom: 20,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		width: "100%",
		marginBottom: 15,
	},
	backButton: {
		fontSize: 16,
		color: "#2089dc",
		fontWeight: "500",
	},
	filterTitle: {
		fontSize: 18,
		fontWeight: "bold",
		marginBottom: 20,
		alignSelf: "center",
	},
	dropdown: {
		backgroundColor: "white",
		borderColor: "#ccc",
		marginBottom: 15,
	},
	dropdownList: {
		backgroundColor: "white",
		borderColor: "#ccc",
	},
	dropdownItem: {
		paddingVertical: 8,
	},
	checkboxContainer: {
		width: "100%",
		marginTop: 10,
		marginBottom: 20,
	},
	filterButton: {
		marginVertical: 5,
	},
	applyButton: {
		backgroundColor: "#2089dc",
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 10,
		width: "100%",
	},
	applyButtonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
	filterOption: {
		backgroundColor: "#f5f5f5",
		paddingVertical: 12,
		paddingHorizontal: 20,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 5,
		width: "100%",
		borderWidth: 1,
		borderColor: "#ccc",
	},
	filterText: {
		fontSize: 16,
		fontWeight: "500",
	},
});
