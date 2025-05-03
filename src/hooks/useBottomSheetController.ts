import { useState, useCallback, useRef } from "react";
import BottomSheet from "@gorhom/bottom-sheet";

export const useBottomSheetController = (snapPoints: string[]) => {
	const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
	const [bottomSheetPosition, setBottomSheetPosition] = useState(-1);
	const bottomSheetRef = useRef<BottomSheet>(null);

	const closeBottomSheet = useCallback(() => {
		bottomSheetRef.current?.close();
		setBottomSheetPosition(-1);
		setIsBottomSheetVisible(false);
	}, []);

	const handleToggleBottomSheet = useCallback(() => {
		if (isBottomSheetVisible) {
			closeBottomSheet();
		} else {
			bottomSheetRef.current?.snapToIndex(0);
			setBottomSheetPosition(0);
			setIsBottomSheetVisible(true);
		}
	}, [isBottomSheetVisible, closeBottomSheet]);

	const handleSheetChanges = useCallback((index: number) => {
		setIsBottomSheetVisible(index !== -1);
		setBottomSheetPosition(index);
	}, []);

	return {
		bottomSheetRef,
		bottomSheetPosition,
		isBottomSheetVisible,
		handleToggleBottomSheet,
		handleSheetChanges,
		closeBottomSheet,
	};
};
