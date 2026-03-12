import { useState, useMemo, useCallback, useEffect } from "react";
import { FilterType } from "../../types";
import { useBottomSheetController } from "./useBottomSheetController";

interface UseCalendarScreenStateParams {
	isAdmin: boolean | null;
	isLoading: boolean;
	settings: any;
}

export const useCalendarScreenState = ({
	isAdmin,
	isLoading,
	settings,
}: UseCalendarScreenStateParams) => {
	const [selectedDate, setSelectedDate] = useState<string>(null);
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	const [availableWorkers, setAvailableWorkers] = useState([]);
	const [openSelect, setOpenSelect] = useState(false);
	const [showAllSelectedOnly, setShowAllSelectedOnly] = useState(false);
	const [showExactSelectedOnly, setShowExactSelectedOnly] = useState(false);
	const [calendarOpen, setCalendarOpen] = useState(false);
	const [filterType, setFilterType] = useState<FilterType>(FilterType.MY);

	const snapPoints = useMemo(() => ["65%", "90%"], []);
	const {
		bottomSheetRef,
		bottomSheetPosition,
		isBottomSheetVisible,
		handleToggleBottomSheet,
		handleSheetChanges,
		closeBottomSheet,
	} = useBottomSheetController(snapPoints);

	useEffect(() => {
		if (isAdmin) {
			setFilterType(
				settings?.defaultCalendarFilter
					? settings.defaultCalendarFilter
					: FilterType.ALL,
			);
		} else {
			setFilterType(FilterType.MY);
		}
	}, [isLoading, isAdmin, settings?.defaultCalendarFilter]);

	const handleFilterChange = useCallback(
		(type: FilterType) => {
			if (!isAdmin) return;

			setFilterType(type);
			if (type === FilterType.SPECIFIC && !selectedUsers.length) {
				return;
			}
			closeBottomSheet();
		},
		[isAdmin, selectedUsers.length, closeBottomSheet],
	);

	const checkSelectOpen = useCallback(() => {
		setOpenSelect((prevOpenSelect) => {
			const nextOpenSelect = !prevOpenSelect;
			if (nextOpenSelect) {
				bottomSheetRef.current?.snapToIndex(1);
			}
			return nextOpenSelect;
		});
	}, [bottomSheetRef]);

	const handleTodayPress = useCallback(() => {
		setSelectedDate(null);
	}, []);

	const handleCalendarOpen = useCallback(() => {
		setCalendarOpen(true);
	}, []);

	const handleCalendarClose = useCallback(() => {
		setCalendarOpen(false);
	}, []);

	return {
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
	};
};
