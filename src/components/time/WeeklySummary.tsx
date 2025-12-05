import React from "react";
import { View, StyleSheet } from "react-native";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { Spacer } from "../ui/Spacer";
import { useTheme } from "../../contexts/ThemeContext";

interface WeeklyStats {
	hours: number;
	minutes: number;
	seconds: number;
	count: number;
}

interface WeeklySummaryProps {
	weeklyStats: WeeklyStats;
}

/**
 * WeeklySummary - Display weekly time tracking statistics
 *
 * Shows:
 * - Total hours worked this week
 * - Number of shifts/entries
 */
export const WeeklySummary: React.FC<WeeklySummaryProps> = ({
	weeklyStats,
}) => {
	const { theme } = useTheme();

	return (
		<Card padding="lg" style={styles.card}>
			<Text variant="h3" color="primary">
				Summary
			</Text>
			<Spacer size="md" />
			<View style={styles.summaryStats}>
				<View style={styles.statItem}>
					<Text
						variant="h2"
						style={{ color: theme.LocationBlue }}
						weight="bold"
					>
						{weeklyStats.hours}h {weeklyStats.minutes}m
						{weeklyStats.seconds > 0 && ` ${weeklyStats.seconds}s`}
					</Text>
					<Spacer size="xs" />
					<Text variant="caption" color="secondary">
						Total Hours
					</Text>
				</View>
				<View
					style={[
						styles.divider,
						{ backgroundColor: theme.SecondaryText },
					]}
				/>
				<View style={styles.statItem}>
					<Text
						variant="h2"
						style={{ color: theme.LocationBlue }}
						weight="bold"
					>
						{weeklyStats.count}
					</Text>
					<Spacer size="xs" />
					<Text variant="caption" color="secondary">
						Shifts
					</Text>
				</View>
			</View>
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		marginVertical: 8,
		width: "100%",
	},
	summaryStats: {
		flexDirection: "row",
		justifyContent: "space-around",
	},
	statItem: {
		alignItems: "center",
		flex: 1,
	},
	divider: {
		width: 1,
		marginHorizontal: 12,
	},
});
