import React, { useState, useMemo, useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import moment from "moment";
import { useUser } from "../../contexts/UserContext";
import { useBottomSheetController } from "../../hooks/useBottomSheetController";
import { FilterPanel } from "../../components/calendar/FilterPanel";
import { FloatingActionButtons } from "../../components/calendar/FloatingActionButtons";
import LoadingScreen from "../LoadingScreen";
import { FilterType } from "../../types";
import Timesheet from "../../components/calendar/Timesheet";

const today = moment().format("YYYY-MM-DD");

const CalendarScreen = ({ navigation }: { navigation: any }) => {
	// User State
	const { user, isAdmin, isLoading } = useUser();

	// Date Selection
	const [selectedDate, setSelectedDate] = useState<string>(null);

	// Filter Options
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	const [availableWorkers, setAvailableWorkers] = useState([]);
	const [openSelect, setOpenSelect] = useState(false);
	const [showAllSelectedOnly, setShowAllSelectedOnly] = useState(false);
	const [showExactSelectedOnly, setShowExactSelectedOnly] = useState(false);
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [filterType, setFilterType] = useState<FilterType>(FilterType.MY);

	useEffect(() => {
		setFilterType(isAdmin ? FilterType.ALL : FilterType.MY);
	}, [isLoading, isAdmin]);

	// The rest of your component remains the same
	const handleFilterChange = (type: FilterType) => {
		if (!isAdmin) return;

		setFilterType(type);
		if (type === FilterType.SPECIFIC && !selectedUsers.length) {
			return;
		}
		closeBottomSheet();
	};

	// Bottom Sheet
	const snapPoints = useMemo(() => ["65%", "90%"], []);
	const {
		bottomSheetRef,
		bottomSheetPosition,
		isBottomSheetVisible,
		handleToggleBottomSheet,
		handleSheetChanges,
		closeBottomSheet,
	} = useBottomSheetController(snapPoints);

	const checkSelectOpen = () => {
		setOpenSelect(!openSelect);
		if (!openSelect) {
			bottomSheetRef.current?.snapToIndex(1);
		}
	};

	const insets = useSafeAreaInsets();

	if (isLoading || isAdmin === null) {
		return <LoadingScreen />;
	}

	return (
		<View
			style={{
				flex: 1,
				paddingTop: insets.top,
				backgroundColor: "#f2f7f7",
			}}
		>
			<View style={styles.container}>
				{user ? (
					<Timesheet
						filterType={filterType}
						selectedUsers={selectedUsers}
						showAllSelectedOnly={showAllSelectedOnly}
						showExactSelectedOnly={showExactSelectedOnly}
						navigation={navigation}
						onCalOpen={() => setCalendarOpen(true)}
						onCalClose={() => setCalendarOpen(false)}
						selectedDate={selectedDate}
						setSelectedDate={setSelectedDate}
						locked={isBottomSheetVisible}
					/>
				) : (
					<LoadingScreen />
				)}

				<FilterPanel
					filterType={filterType}
					handleFilterChange={handleFilterChange}
					bottomSheetRef={bottomSheetRef}
					bottomSheetPosition={bottomSheetPosition}
					handleSheetChanges={handleSheetChanges}
					snapPoints={snapPoints}
					selectedUsers={selectedUsers}
					setSelectedUsers={setSelectedUsers}
					availableWorkers={availableWorkers}
					setAvailableWorkers={setAvailableWorkers}
					openSelect={openSelect}
					checkSelectOpen={checkSelectOpen}
					showAllSelectedOnly={showAllSelectedOnly}
					setShowAllSelectedOnly={setShowAllSelectedOnly}
					showExactSelectedOnly={showExactSelectedOnly}
					setShowExactSelectedOnly={setShowExactSelectedOnly}
					setFilterType={setFilterType}
					isAdmin={isAdmin}
					companyId={user?.loggedInCompany}
				/>
			</View>

			<FloatingActionButtons
				isAdmin={isAdmin}
				selectedDate={selectedDate}
				today={today}
				isBottomSheetVisible={isBottomSheetVisible || calendarOpen}
				onAddEvent={() =>
					navigation.navigate("EditEvent", { event: null })
				}
				onFilterPress={handleToggleBottomSheet}
				onTodayPress={() => setSelectedDate(null)}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	calendar: {
		paddingLeft: 20,
		paddingRight: 20,
	},
	section: {
		backgroundColor: "#f2f7f7",
		color: "grey",
		textTransform: "capitalize",
	},
});

export default CalendarScreen;
