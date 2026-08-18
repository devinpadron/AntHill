import React from "react";
import { StyleSheet, View } from "react-native";
import { format } from "date-fns";
import {
	formatDuration,
	getStatusBadgeText,
	getStatusTone,
} from "../../utils/timeUtils";
import { Badge, Card, Text } from "../ui";
import { Theme, useThemedStyles } from "../../theme";

/**
 * The header block over a time-entry detail view.
 *
 * Total hours lead, because that is what both the worker and the approver are
 * actually here to check.
 *
 * The status colour helpers used to be passed in as props by every caller;
 * they come from `timeUtils` directly now, so a badge cannot differ between the
 * two screens that render this.
 */
const TimeEntrySummary = ({
	employeeUser,
	totalDurationSeconds,
	totalDurationDecimal,
	timeEntries,
}) => {
	const styles = useThemedStyles(summaryStyles);

	/*
	 * `a?.x + " " + a?.y` yields the STRING "undefined undefined" when the
	 * object is absent — which is truthy, so a `|| "Unknown"` fallback on the
	 * concatenation never fired.
	 */
	const employeeName =
		[employeeUser?.firstName, employeeUser?.lastName]
			.filter(Boolean)
			.join(" ") || "Unknown";

	const dateRange =
		timeEntries.length === 0
			? "—"
			: timeEntries.length === 1
				? format(timeEntries[0].clockInAt.toDate(), "MMM d, yyyy")
				: `${format(
						timeEntries[0].clockInAt.toDate(),
						"MMM d",
					)} – ${format(
						timeEntries[timeEntries.length - 1].clockInAt.toDate(),
						"MMM d, yyyy",
					)}`;

	return (
		<Card style={styles.card}>
			{/*
			 * Decimal hours lead, h/m explains them.
			 *
			 * The decimal figure is the one that gets typed into payroll, so it
			 * is the number this block exists to hand over; "8h 30m" is the
			 * sanity check on it, not the other way round. The unit moves to
			 * the accessibility label rather than being dropped — a screen
			 * reader announcing a bare "8.5" is not useful.
			 */}
			<View style={styles.hero}>
				<Text
					variant="display"
					accessibilityLabel={`${totalDurationDecimal} decimal hours`}
				>
					{totalDurationDecimal}
				</Text>
				<Text variant="caption" color="textSecondary">
					{formatDuration(totalDurationSeconds)}
				</Text>
			</View>

			<View style={styles.row}>
				<Text variant="body" color="textSecondary">
					Employee
				</Text>
				<Text variant="bodyStrong">{employeeName}</Text>
			</View>

			<View style={styles.row}>
				<Text variant="body" color="textSecondary">
					Dates
				</Text>
				<Text variant="bodyStrong">{dateRange}</Text>
			</View>

			<View style={styles.row}>
				<Text variant="body" color="textSecondary">
					Status
				</Text>
				{timeEntries.length === 1 ? (
					<Badge
						label={getStatusBadgeText(timeEntries[0].status)}
						tone={getStatusTone(timeEntries[0].status)}
						dot
					/>
				) : (
					<Badge label={`${timeEntries.length} entries`} />
				)}
			</View>
		</Card>
	);
};

export default TimeEntrySummary;

const summaryStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			margin: theme.spacing.lg,
		},
		hero: {
			alignItems: "center",
			paddingBottom: theme.spacing.lg,
			marginBottom: theme.spacing.md,
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		row: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: theme.spacing.md,
			paddingVertical: theme.spacing.xs,
		},
	});
