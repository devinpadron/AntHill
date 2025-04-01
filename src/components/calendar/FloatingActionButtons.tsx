import React, { useEffect, useMemo, useState } from "react";
import { Animated, TouchableOpacity, StyleSheet } from "react-native";
import { Filter, PlusCircle } from "react-native-feather";
import { Button } from "../ui/Button";

type FloatingActionButtonsProps = {
	isAdmin: boolean;
	selectedDate: string;
	today: string;
	isBottomSheetVisible: boolean;
	fabOpacity: Animated.Value;
	onAddEvent: () => void;
	onFilterPress: () => void;
	onTodayPress: () => void;
};

export const FloatingActionButtons: React.FC<FloatingActionButtonsProps> = ({
	isAdmin,
	selectedDate,
	today,
	isBottomSheetVisible,
	fabOpacity,
	onAddEvent,
	onFilterPress,
	onTodayPress,
}) => {
	const showTodayButton = useMemo(() => {
		return selectedDate !== today;
	}, [selectedDate, today]);
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
						title="Today"
						onPress={onTodayPress}
						style={styles.todayButton}
						textStyle={styles.todayButtonText}
						variant="outline"
						size="small"
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
