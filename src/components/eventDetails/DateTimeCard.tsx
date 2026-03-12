import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import moment from "moment";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { useTheme } from "../../contexts/ThemeContext";
import { Spacing, IconSize } from "../../constants/tokens";

interface DateTimeCardProps {
	date: string;
	startTime?: string;
	endTime?: string;
	duration?: number;
}

/**
 * DateTimeCard - Displays event date, time range, and duration
 */
export const DateTimeCard: React.FC<DateTimeCardProps> = ({
	date,
	startTime,
	endTime,
	duration,
}) => {
	const { theme } = useTheme();

	return (
		<Card padding="md" elevation="md" style={styles.card}>
			<View style={styles.dateTimeContainer}>
				<View style={styles.dateContainer}>
					<Ionicons
						name="calendar-outline"
						size={IconSize.sm}
						color={theme.LocationBlue}
						style={styles.icon}
					/>
					<Text variant="body" weight="semibold" color="primary">
						{moment(date).format("dddd, MMMM D, YYYY")}
					</Text>
				</View>

				{startTime && (
					<View style={styles.timeContainer}>
						<Ionicons
							name="time-outline"
							size={IconSize.sm}
							color={theme.LocationBlue}
							style={styles.icon}
						/>
						<View style={styles.timeTextContainer}>
							<Text
								variant="body"
								weight="medium"
								color="primary"
							>
								{moment(startTime, "YYYY-MM-DD HH:mm").format(
									"h:mm A",
								)}
								{endTime && (
									<Text
										variant="body"
										weight="medium"
										color="primary"
									>
										{" - "}
										{moment(
											endTime,
											"YYYY-MM-DD HH:mm",
										).format("h:mm A")}
									</Text>
								)}
							</Text>
							{duration && (
								<Text
									variant="caption"
									color="secondary"
									style={styles.durationText}
								>
									Duration: {duration} hours
								</Text>
							)}
						</View>
					</View>
				)}
			</View>
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		marginBottom: Spacing.lg,
	},
	dateTimeContainer: {
		flexDirection: "column",
	},
	dateContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.md,
	},
	timeContainer: {
		flexDirection: "row",
		alignItems: "flex-start",
	},
	timeTextContainer: {
		flexDirection: "column",
	},
	icon: {
		marginRight: Spacing.sm,
	},
	durationText: {
		marginTop: Spacing.xs,
	},
});
