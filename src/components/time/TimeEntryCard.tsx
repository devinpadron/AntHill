import React from "react";
import { StyleSheet, View } from "react-native";
import { format } from "date-fns";
import { getStatusBadgeText, getStatusTone } from "../../utils/timeUtils";
import { useEntryElapsed } from "../../hooks/useEntryElapsed";
import { Badge, Button, Card, Icon, Text } from "../ui";
import { Theme, useThemedStyles } from "../../theme";

/**
 * One shift in the week's list.
 *
 * A live entry ticks every second; a finished one shows its stored total. The
 * status is a themed `Badge` rather than the pastel hex `getStatusBadgeColor`
 * used to return, and the row of label/value pairs is a compact stat strip
 * instead of four stacked icon rows.
 */
const TimeEntryCard = ({ timeEntry, onPress, onSubmit }) => {
	const styles = useThemedStyles(cardStyles);

	/*
	 * Shared with the clock control on the Clock screen, so a shift in this list
	 * and the big timer above it cannot disagree about how long it has run.
	 */
	const elapsed = useEntryElapsed(timeEntry);
	const { isPaused, isLive } = elapsed;

	const entryDate = timeEntry.clockInAt.toDate();
	const formattedDate = format(entryDate, "EEE, MMM d");
	const clockInTime = format(entryDate, "h:mm a");

	const clockOutTime = timeEntry.clockOutAt
		? format(timeEntry.clockOutAt.toDate(), "h:mm a")
		: isPaused
			? "Paused"
			: "Running";

	// Only a finished, unsubmitted entry can be sent for approval.
	const canSubmit =
		timeEntry.status === "completed" &&
		timeEntry.status !== "pending_approval";

	const split = (totalSeconds: number) => ({
		hours: Math.floor(totalSeconds / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60),
		seconds: totalSeconds % 60,
	});

	const duration = split(elapsed.workedSeconds);

	/*
	 * A running shift counts in seconds so it visibly moves; a finished one is
	 * a decimal hour figure, which is what payroll reads.
	 */
	const durationString = isLive
		? `${duration.hours > 0 ? `${duration.hours}h ` : ""}${
				duration.minutes > 0 || duration.hours > 0
					? `${duration.minutes}m `
					: ""
			}${duration.seconds}s`
		: `${(duration.hours + duration.minutes / 60).toFixed(2)}h`;

	const formatPause = (totalSeconds: number) => {
		const { hours, minutes, seconds } = split(totalSeconds);
		if (hours > 0) return `${hours}h ${minutes}m`;
		if (minutes > 0) return `${minutes}m ${seconds}s`;
		return `${seconds}s`;
	};

	return (
		<Card style={styles.card} onPress={onPress}>
			<View style={styles.header}>
				<Text variant="bodyStrong">{formattedDate}</Text>
				<Badge
					label={getStatusBadgeText(timeEntry.status)}
					tone={getStatusTone(timeEntry.status)}
					dot
				/>
			</View>

			<View style={styles.times}>
				<View style={styles.timeBlock}>
					<Text variant="caption" color="textSecondary" uppercase>
						In
					</Text>
					<Text variant="bodyStrong">{clockInTime}</Text>
				</View>

				<Icon
					name="arrow-forward"
					size="sm"
					color="textTertiary"
					style={styles.arrow}
				/>

				<View style={styles.timeBlock}>
					<Text variant="caption" color="textSecondary" uppercase>
						Out
					</Text>
					<Text
						variant="bodyStrong"
						color={isLive ? "accent" : "text"}
					>
						{clockOutTime}
					</Text>
				</View>

				<View style={styles.spacer} />

				<View style={styles.timeBlockEnd}>
					<Text variant="caption" color="textSecondary" uppercase>
						Worked
					</Text>
					<Text variant="bodyStrong">{durationString}</Text>
				</View>
			</View>

			{(isPaused || elapsed.pausedSeconds > 0) && (
				<View style={styles.metaRow}>
					<Icon name="pause-circle" size="xs" color="warning" />
					<Text variant="caption" color="textSecondary">
						Paused for {formatPause(elapsed.pausedSeconds)}
					</Text>
				</View>
			)}

			{!!timeEntry.eventTitle && (
				<View style={styles.metaRow}>
					<Icon name="calendar" size="xs" color="accent" />
					<Text
						variant="caption"
						color="textSecondary"
						numberOfLines={1}
						style={styles.flex}
					>
						{timeEntry.eventTitle}
					</Text>
				</View>
			)}

			{canSubmit && !!onSubmit && (
				<Button
					title="Submit for approval"
					icon="paper-plane-outline"
					variant="secondary"
					size="small"
					fullWidth
					onPress={() => onSubmit(timeEntry)}
					style={styles.submit}
				/>
			)}
		</Card>
	);
};

export default TimeEntryCard;

const cardStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		card: {
			marginBottom: theme.spacing.md,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: theme.spacing.md,
		},
		times: {
			flexDirection: "row",
			alignItems: "center",
		},
		timeBlock: {
			gap: 2,
		},
		timeBlockEnd: {
			alignItems: "flex-end",
			gap: 2,
		},
		arrow: {
			marginHorizontal: theme.spacing.md,
		},
		spacer: {
			flex: 1,
		},
		metaRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
			marginTop: theme.spacing.md,
		},
		submit: {
			marginTop: theme.spacing.lg,
		},
	});
