import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format } from "date-fns";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacer } from "../ui/Spacer";

interface DateRangeSelectorProps {
	currentStartDate: Date;
	currentEndDate: Date;
	onPrevWeek: () => void;
	onNextWeek: () => void;
	onCurrentWeek: () => void;
	onStartDatePress: () => void;
	onEndDatePress: () => void;
}

/**
 * DateRangeSelector - Week navigation and date range selection
 *
 * Provides controls for:
 * - Navigating to previous/next/current week
 * - Selecting custom start and end dates
 */
export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
	currentStartDate,
	currentEndDate,
	onPrevWeek,
	onNextWeek,
	onCurrentWeek,
	onStartDatePress,
	onEndDatePress,
}) => {
	const { theme } = useTheme();

	return (
		<View>
			<View style={styles.dateControls}>
				<TouchableOpacity
					onPress={onPrevWeek}
					style={styles.dateNavButton}
				>
					<Icon
						name="chevron-left"
						size={24}
						color={theme.LocationBlue}
					/>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={onCurrentWeek}
					style={[
						styles.currentWeekButton,
						{ backgroundColor: theme.CardBackground },
					]}
				>
					<Text
						variant="body"
						style={{ color: theme.LocationBlue }}
						weight="medium"
					>
						Current Week
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={onNextWeek}
					style={styles.dateNavButton}
				>
					<Icon
						name="chevron-right"
						size={24}
						color={theme.LocationBlue}
					/>
				</TouchableOpacity>
			</View>

			<Spacer size="sm" />

			<View style={styles.dateRange}>
				<TouchableOpacity
					onPress={onStartDatePress}
					style={[
						styles.dateButton,
						{ backgroundColor: theme.CardBackground },
					]}
				>
					<Icon
						name="calendar"
						size={18}
						color={theme.SecondaryText}
						style={styles.calendarIcon}
					/>
					<Text variant="body" color="primary">
						{format(currentStartDate, "MMM d, yyyy")}
					</Text>
				</TouchableOpacity>

				<Text
					variant="body"
					color="secondary"
					style={styles.dateRangeSeparator}
				>
					to
				</Text>

				<TouchableOpacity
					onPress={onEndDatePress}
					style={[
						styles.dateButton,
						{ backgroundColor: theme.CardBackground },
					]}
				>
					<Icon
						name="calendar"
						size={18}
						color={theme.SecondaryText}
						style={styles.calendarIcon}
					/>
					<Text variant="body" color="primary">
						{format(currentEndDate, "MMM d, yyyy")}
					</Text>
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	dateControls: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 8,
	},
	dateNavButton: {
		paddingHorizontal: 32,
	},
	currentWeekButton: {
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 16,
	},
	dateRange: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	dateButton: {
		flexDirection: "row",
		alignItems: "center",
		padding: 8,
		borderRadius: 8,
	},
	calendarIcon: {
		marginRight: 6,
	},
	dateRangeSeparator: {
		marginHorizontal: 8,
	},
});
