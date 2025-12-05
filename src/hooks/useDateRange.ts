import { useState, useCallback } from "react";
import { Alert } from "react-native";
import { startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

interface UseDateRangeParams {
	workWeekStarts?: "sunday" | "monday";
}

/**
 * useDateRange - Manage date range selection with week navigation
 *
 * Handles:
 * - Current week calculation based on work week start preference
 * - Week navigation (previous/next/current)
 * - Date picker state management
 * - Date validation
 */
export const useDateRange = ({
	workWeekStarts = "monday",
}: UseDateRangeParams = {}) => {
	const weekStartsOn = workWeekStarts === "sunday" ? 0 : 1;

	const [currentStartDate, setCurrentStartDate] = useState(() =>
		startOfWeek(new Date(), { weekStartsOn }),
	);

	const [currentEndDate, setCurrentEndDate] = useState(() =>
		endOfWeek(new Date(), { weekStartsOn }),
	);

	const [showStartDatePicker, setShowStartDatePicker] = useState(false);
	const [showEndDatePicker, setShowEndDatePicker] = useState(false);

	const goToPrevWeek = useCallback(() => {
		setCurrentStartDate((prev) => subWeeks(prev, 1));
		setCurrentEndDate((prev) => subWeeks(prev, 1));
	}, []);

	const goToNextWeek = useCallback(() => {
		setCurrentStartDate((prev) => addWeeks(prev, 1));
		setCurrentEndDate((prev) => addWeeks(prev, 1));
	}, []);

	const goToCurrentWeek = useCallback(() => {
		setCurrentStartDate(startOfWeek(new Date(), { weekStartsOn }));
		setCurrentEndDate(endOfWeek(new Date(), { weekStartsOn }));
	}, [weekStartsOn]);

	const handleStartDateChange = useCallback(
		(date: Date) => {
			setShowStartDatePicker(false);
			if (date > currentEndDate) {
				Alert.alert(
					"Invalid Date Range",
					"Start date cannot be after end date",
				);
				return;
			}
			setCurrentStartDate(date);
		},
		[currentEndDate],
	);

	const handleEndDateChange = useCallback(
		(date: Date) => {
			setShowEndDatePicker(false);
			if (date < currentStartDate) {
				Alert.alert(
					"Invalid Date Range",
					"End date cannot be before start date",
				);
				return;
			}
			setCurrentEndDate(date);
		},
		[currentStartDate],
	);

	return {
		currentStartDate,
		currentEndDate,
		showStartDatePicker,
		showEndDatePicker,
		setShowStartDatePicker,
		setShowEndDatePicker,
		goToPrevWeek,
		goToNextWeek,
		goToCurrentWeek,
		handleStartDateChange,
		handleEndDateChange,
	};
};
