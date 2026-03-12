import React, { useMemo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import moment from "moment";
import { useUser } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useCalendarScreenState } from "../../hooks/useCalendarScreenState";
import { FilterPanel } from "../../components/calendar/FilterPanel";
import { FloatingActionButtons } from "../../components/calendar/FloatingActionButtons";
import LoadingScreen from "../LoadingScreen";
import Timesheet from "../../components/calendar/Timesheet";

const today = moment().format("YYYY-MM-DD");

const CalendarScreen = ({ navigation }: { navigation: any }) => {
	// User State
	const { user, isAdmin, isLoading, settings } = useUser();
	const { theme } = useTheme();
	const {
		selectedDate,
		setSelectedDate,
		selectedUsers,
		setSelectedUsers,
		availableWorkers,
		setAvailableWorkers,
		openSelect,
		showAllSelectedOnly,
		setShowAllSelectedOnly,
		showExactSelectedOnly,
		setShowExactSelectedOnly,
		calendarOpen,
		filterType,
		setFilterType,
		handleFilterChange,
		snapPoints,
		bottomSheetRef,
		bottomSheetPosition,
		isBottomSheetVisible,
		handleToggleBottomSheet,
		handleSheetChanges,
		checkSelectOpen,
		handleTodayPress,
		handleCalendarOpen,
		handleCalendarClose,
	} = useCalendarScreenState({ isAdmin, isLoading, settings });

	const insets = useSafeAreaInsets();
	const rootStyle = useMemo(
		() => [
			styles.root,
			{
				paddingTop: insets.top,
				backgroundColor: theme.Background,
			},
		],
		[insets.top, theme.Background],
	);
	const handleAddEvent = useCallback(() => {
		navigation.navigate("EditEvent", { event: null });
	}, [navigation]);

	if (isLoading || isAdmin === null) {
		return <LoadingScreen />;
	}

	return (
		<View style={rootStyle}>
			<View style={styles.container}>
				{user ? (
					<Timesheet
						filterType={filterType}
						selectedUsers={selectedUsers}
						showAllSelectedOnly={showAllSelectedOnly}
						showExactSelectedOnly={showExactSelectedOnly}
						navigation={navigation}
						onCalOpen={handleCalendarOpen}
						onCalClose={handleCalendarClose}
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
				onAddEvent={handleAddEvent}
				onFilterPress={handleToggleBottomSheet}
				onTodayPress={handleTodayPress}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	root: {
		flex: 1,
	},
	container: {
		flex: 1,
	},
});

export default CalendarScreen;
