import { useState, useCallback, useRef } from "react";
import { Animated } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";

export const useBottomSheetController = (snapPoints: string[]) => {
	const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
	const [bottomSheetPosition, setBottomSheetPosition] = useState(-1);
	const bottomSheetRef = useRef<BottomSheet>(null);
	const fabOpacity = useRef(new Animated.Value(1)).current;

	const closeBottomSheet = useCallback(() => {
		bottomSheetRef.current?.close();
		setBottomSheetPosition(-1);
		setIsBottomSheetVisible(false);
		Animated.timing(fabOpacity, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start();
	}, [fabOpacity]);

	const handleToggleBottomSheet = useCallback(() => {
		if (isBottomSheetVisible) {
			closeBottomSheet();
		} else {
			Animated.timing(fabOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start();
			bottomSheetRef.current?.snapToIndex(0);
			setBottomSheetPosition(0);
			setIsBottomSheetVisible(true);
		}
	}, [isBottomSheetVisible, fabOpacity, closeBottomSheet]);

	const handleSheetChanges = useCallback(
		(index: number) => {
			setIsBottomSheetVisible(index !== -1);
			setBottomSheetPosition(index);
			if (index === -1) {
				Animated.timing(fabOpacity, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}).start();
			}
		},
		[fabOpacity],
	);

	return {
		bottomSheetRef,
		bottomSheetPosition,
		isBottomSheetVisible,
		fabOpacity,
		handleToggleBottomSheet,
		handleSheetChanges,
		closeBottomSheet,
	};
};
