import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, TouchableOpacity, StyleSheet } from "react-native";
import { ArrowLeft, Filter, PlusCircle } from "react-native-feather";
import { Button } from "../ui/Button";

type FloatingActionButtonsProps = {
	isAdmin: boolean;
	selectedDate: string;
	today: string;
	isBottomSheetVisible: boolean;
	onAddEvent: () => void;
	onFilterPress: () => void;
	onTodayPress: () => void;
};

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
	isAdmin,
	selectedDate,
	today,
	isBottomSheetVisible,
	onAddEvent,
	onFilterPress,
	onTodayPress,
}) => {
	const showTodayButton = useMemo(() => {
		return selectedDate !== null;
	}, [selectedDate, today]);

	const fabOpacity = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		if (isBottomSheetVisible) {
			Animated.timing(fabOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start();
		} else {
			Animated.timing(fabOpacity, {
				toValue: 1,
				duration: 200,
				useNativeDriver: true,
			}).start();
		}
	}, [isBottomSheetVisible]);

	return (
		<>
			{isAdmin && (
				<>
					<Animated.View
						style={{ opacity: fabOpacity }}
						pointerEvents={isBottomSheetVisible ? "none" : "auto"}
					>
						<TouchableOpacity
							style={styles.addEventButton}
							onPress={onAddEvent}
						>
							<PlusCircle stroke="black" width={24} height={24} />
						</TouchableOpacity>
					</Animated.View>
					<Animated.View
						style={{ opacity: fabOpacity }}
						pointerEvents={isBottomSheetVisible ? "none" : "auto"}
					>
						<TouchableOpacity
							style={styles.filterButton}
							onPress={onFilterPress}
						>
							<Filter stroke="black" width={24} height={24} />
						</TouchableOpacity>
					</Animated.View>
				</>
			)}

			{/* Today Button - Only show when not on today's date */}
			{showTodayButton && (
				<Animated.View
					style={{ opacity: fabOpacity }}
					pointerEvents={isBottomSheetVisible ? "none" : "auto"}
				>
					<Button
						onPress={onTodayPress}
						style={styles.todayButton}
						textStyle={styles.todayButtonText}
						variant="outline"
						size="small"
						icon={
							<ArrowLeft
								stroke="#2089dc"
								width={20}
								height={20}
							/>
						}
						iconPosition="center"
					/>
				</Animated.View>
			)}
		</>
	);
};

const styles = StyleSheet.create({
	filterButton: {
		position: "absolute",
		bottom: 10,
		right: 70,
		zIndex: 999,
		padding: 12,
		backgroundColor: "white",
		borderRadius: 30,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 8,
	},
	addEventButton: {
		position: "absolute",
		bottom: 10,
		right: 10,
		zIndex: 999,
		padding: 12,
		backgroundColor: "white",
		borderRadius: 30,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 8,
	},
	todayButton: {
		position: "absolute",
		bottom: 10,
		left: 10,
		zIndex: 999,
		backgroundColor: "white",
		borderRadius: 30,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 8,
	},
	todayButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: "#2089dc",
	},
});
