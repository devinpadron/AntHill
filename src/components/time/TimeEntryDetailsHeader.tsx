import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";

interface TimeEntryDetailsHeaderProps {
	entryCount: number;
	isAdmin: boolean;
	onBack: () => void;
	onExport?: () => void;
}

/**
 * TimeEntryDetailsHeader - Header for time entry details screen
 *
 * Displays:
 * - Back button
 * - Screen title (Time Entry/Time Entries)
 * - Export button (admin only)
 */
export const TimeEntryDetailsHeader: React.FC<TimeEntryDetailsHeaderProps> = ({
	entryCount,
	isAdmin,
	onBack,
	onExport,
}) => {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<View
			style={[
				styles.header,
				{
					backgroundColor: theme.CardBackground,
					paddingTop: insets.top,
				},
			]}
		>
			<TouchableOpacity onPress={onBack} style={styles.backButton}>
				<Icon name="arrow-left" size={24} color={theme.LocationBlue} />
			</TouchableOpacity>
			<Text variant="h3" color="primary" style={styles.headerTitle}>
				{entryCount > 1 ? "Time Entries" : "Time Entry"}
			</Text>
			{isAdmin && onExport ? (
				<TouchableOpacity onPress={onExport}>
					<Icon
						name="export-variant"
						size={24}
						color={theme.LocationBlue}
					/>
				</TouchableOpacity>
			) : (
				<View style={styles.placeholder} />
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	backButton: {
		padding: 4,
	},
	headerTitle: {
		flex: 1,
		textAlign: "center",
	},
	placeholder: {
		width: 32, // Match icon width for centering
	},
});
