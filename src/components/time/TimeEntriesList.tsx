import React from "react";
import {
	View,
	StyleSheet,
	FlatList,
	RefreshControl,
	TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Text } from "../ui/Text";
import { EmptyState } from "../ui/EmptyState";
import { useTheme } from "../../contexts/ThemeContext";
import TimeEntryCard from "./TimeEntryCard";
import { TimeEntry } from "../../types";

interface TimeEntriesListProps {
	timeEntries: TimeEntry[];
	refreshing: boolean;
	onRefresh: () => void;
	onViewDetails: (entryId: string) => void;
	onSelectEntry: (entry: TimeEntry) => void;
	showViewAllButton?: boolean;
	onViewAllPress?: () => void;
}

/**
 * TimeEntriesList - Display list of time entries with pull-to-refresh
 *
 * Shows:
 * - List of time entry cards
 * - Pull-to-refresh functionality
 * - Empty state when no entries exist
 * - Optional "View All" header button
 */
export const TimeEntriesList: React.FC<TimeEntriesListProps> = ({
	timeEntries,
	refreshing,
	onRefresh,
	onViewDetails,
	onSelectEntry,
	showViewAllButton = true,
	onViewAllPress,
}) => {
	const { theme } = useTheme();

	const renderTimeEntry = ({ item }: { item: TimeEntry }) => {
		return (
			<TimeEntryCard
				timeEntry={item}
				onPress={() => onViewDetails(item.id)}
				onSubmit={
					item.status === "pending_approval"
						? undefined
						: () => onSelectEntry(item)
				}
			/>
		);
	};

	return (
		<View style={styles.container}>
			{showViewAllButton && onViewAllPress && (
				<TouchableOpacity
					style={styles.headerButton}
					onPress={onViewAllPress}
				>
					<Text variant="h3" color="primary">
						Time Entries
					</Text>
					<Icon
						name="chevron-right"
						size={20}
						color={theme.LocationBlue}
					/>
				</TouchableOpacity>
			)}

			{!showViewAllButton && (
				<Text variant="h3" color="primary" style={styles.headerText}>
					Time Entries
				</Text>
			)}

			<FlatList
				data={timeEntries}
				keyExtractor={(item) => item.id}
				renderItem={renderTimeEntry}
				ListEmptyComponent={
					<EmptyState
						icon="time-outline"
						title="No time entries"
						message="No time entries found for this week"
					/>
				}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
						colors={[theme.LocationBlue]}
						tintColor={theme.LocationBlue}
						title="Refreshing..."
						titleColor={theme.TertiaryText}
					/>
				}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 0,
		paddingVertical: 0,
		width: "100%",
	},
	headerButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 6,
		marginBottom: 12,
	},
	headerText: {
		marginBottom: 12,
	},
});
