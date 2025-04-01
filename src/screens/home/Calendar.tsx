import React, { useState, useMemo, useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import moment from "moment";
import { useUser } from "../../contexts/UserContext";
import { useCalendarEvents } from "../../hooks/useCalendarEvents";
import { useBottomSheetController } from "../../hooks/useBottomSheetController";
import { AgendaScreen } from "../../components/calendar/AgendaScreen";
import { FilterPanel } from "../../components/calendar/FilterPanel";
import { FloatingActionButtons } from "../../components/calendar/FloatingActionButtons";
import LoadingScreen from "../LoadingScreen";
import { ALL, FilterType, MY, SPECIFIC } from "../../types";

const today = moment().format("YYYY-MM-DD");

const ExpandableCalendarScreen = ({ navigation }: { navigation: any }) => {
	// User State
	const { user, userId, userPrivilege, isAdmin, isLoading } = useUser();

	// Date Selection
	const [selectedDate, setSelectedDate] = useState(today);

	// Filter Options
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	const [availableWorkers, setAvailableWorkers] = useState([]);
	const [openSelect, setOpenSelect] = useState(false);
	const [showAllSelectedOnly, setShowAllSelectedOnly] = useState(false);
	const [showExactSelectedOnly, setShowExactSelectedOnly] = useState(false);
	const [filterType, setFilterType] = useState<FilterType>(MY);

	useEffect(() => {
		// If not admin, use "my" events by default
		if (
			userPrivilege &&
			userPrivilege !== "Admin" &&
			userPrivilege !== "Owner"
		) {
			setFilterType(MY);
		} else {
			setFilterType(ALL);
		}
	}, [userPrivilege]);

	// The rest of your component remains the same
	const handleFilterChange = (type: FilterType) => {
		if (!isAdmin) return;

		setFilterType(type);
		if (type === SPECIFIC && !selectedUsers.length) {
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
		fabOpacity,
		handleToggleBottomSheet,
		handleSheetChanges,
		closeBottomSheet,
	} = useBottomSheetController(snapPoints);

	// Events
	const { agendaItems, markedDates, refreshKey, refreshAgenda } =
		useCalendarEvents(
			filterType,
			user?.loggedInCompany,
			userId,
			userPrivilege,
			selectedUsers,
			showAllSelectedOnly,
			showExactSelectedOnly,
		);

	const checkSelectOpen = () => {
		setOpenSelect(!openSelect);
		if (!openSelect) {
			bottomSheetRef.current?.snapToIndex(1);
		}
	};

	const insets = useSafeAreaInsets();

	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<View style={{ flex: 1, paddingTop: insets.top }}>
			<View style={styles.container}>
				{user ? (
					<AgendaScreen
						onDayChange={(day) => setSelectedDate(day.dateString)}
						markedDates={markedDates}
						agendaItems={agendaItems}
						selectedDate={selectedDate}
						navigation={navigation}
						key={refreshKey}
						onRefreshData={refreshAgenda}
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
				isBottomSheetVisible={isBottomSheetVisible}
				fabOpacity={fabOpacity}
				onAddEvent={() =>
					navigation.navigate("EditEvent", { event: null })
				}
				onFilterPress={handleToggleBottomSheet}
				onTodayPress={() => setSelectedDate(today)}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "white",
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

export default ExpandableCalendarScreen;
