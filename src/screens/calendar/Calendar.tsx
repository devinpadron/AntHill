import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import moment from "moment";
import { Screen } from "../../components/ui";
import { useUser } from "../../contexts/UserContext";
import { useCompanyMembers } from "../../hooks/useCompanyMembers";
import { useBottomSheetController } from "../../hooks/useBottomSheetController";
import { FilterPanel } from "../../components/calendar/FilterPanel";
import { FloatingActionButtons } from "../../components/calendar/FloatingActionButtons";
import Timesheet from "../../components/calendar/Timesheet";
import LoadingScreen from "../LoadingScreen";
import { FilterType } from "../../types";

/*
 * Calendar container.
 *
 * Structure is unchanged from v1 — same FilterPanel, same floating buttons,
 * same bottom sheet. What changed underneath is that the worker list comes from
 * useCompanyMembers (one query) rather than the panel fetching profiles itself,
 * and the schedule comes from the windowed v2 Timesheet.
 */

const today = moment().format("YYYY-MM-DD");

const CalendarScreen = ({ navigation }: { navigation: any }) => {
	const { user, isAdmin, isLoading, settings, companyId } = useUser();
	const { members } = useCompanyMembers(companyId ?? "");

	const [selectedDate, setSelectedDate] = useState<string | null>(null);
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	const [showAllSelectedOnly, setShowAllSelectedOnly] = useState(false);
	const [showExactSelectedOnly, setShowExactSelectedOnly] = useState(false);
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [filterType, setFilterType] = useState<FilterType>(FilterType.MY);

	// Non-admins only ever see their own schedule.
	useEffect(() => {
		setFilterType(
			isAdmin
				? ((settings?.defaultCalendarFilter as FilterType) ??
						FilterType.ALL)
				: FilterType.MY,
		);
	}, [isAdmin, settings?.defaultCalendarFilter]);

	const snapPoints = useMemo(() => ["65%", "90%"], []);
	const {
		bottomSheetRef,
		bottomSheetPosition,
		isBottomSheetVisible,
		handleToggleBottomSheet,
		handleSheetChanges,
		closeBottomSheet,
	} = useBottomSheetController(snapPoints);

	const handleFilterChange = (type: FilterType) => {
		if (!isAdmin) return;
		setFilterType(type);
		if (type === FilterType.SPECIFIC && !selectedUsers.length) return;
		closeBottomSheet();
	};

	// Gives the worker list the taller snap point once search takes the keyboard.
	const expandSheet = () => bottomSheetRef.current?.snapToIndex(1);

	// The panel expects {label, value} options. In v1 it had to build these by
	// fanning out a profile read per member.
	const availableWorkers = useMemo(
		() => members.map((m) => ({ label: m.displayName, value: m.userId })),
		[members],
	);

	if (isLoading || isAdmin === null) return <LoadingScreen />;

	// Timesheet renders the ScreenHeader itself, so the notch band is declared
	// here rather than inferred from a `header` prop.
	return (
		<Screen topBand="surface">
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
					expandSheet={expandSheet}
					showAllSelectedOnly={showAllSelectedOnly}
					setShowAllSelectedOnly={setShowAllSelectedOnly}
					showExactSelectedOnly={showExactSelectedOnly}
					setShowExactSelectedOnly={setShowExactSelectedOnly}
					setFilterType={setFilterType}
					isAdmin={isAdmin}
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
		</Screen>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1 },
});

export default CalendarScreen;
