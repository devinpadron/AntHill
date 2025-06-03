import React, { useEffect, useRef, useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { format, differenceInSeconds } from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const TimeEntryCard = ({ timeEntry, onPress, onSubmit }) => {
	// Format date and times
	const entryDate = new Date(timeEntry.clockInTime);
	const formattedDate = format(entryDate, "EEEE, MMMM d");
	const clockInTime = format(entryDate, "h:mm a");

	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const intervalRef = useRef(null);

	const clockOutTime = timeEntry.clockOutTime
		? format(new Date(timeEntry.clockOutTime), "h:mm a")
		: timeEntry.status === "paused"
			? "Paused"
			: "Active";

	// Determine if entry can be submitted for approval
	const canSubmit =
		timeEntry.status === "completed" &&
		timeEntry.status !== "pending_approval";

	// Setup and manage timer for active entries
	useEffect(() => {
		// Clear any existing interval first
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}

		if (timeEntry.status === "active") {
			// Calculate initial elapsed time in seconds
			const startDate = new Date(timeEntry.clockInTime);

			// Account for any previous pause time (now using totalPausedSeconds directly)
			const pauseOffset = timeEntry.totalPausedSeconds || 0;

			const initialElapsed =
				differenceInSeconds(new Date(), startDate) - pauseOffset;
			setElapsedSeconds(initialElapsed);

			// Update timer every second
			intervalRef.current = setInterval(() => {
				const currentElapsed =
					differenceInSeconds(new Date(), startDate) - pauseOffset;
				setElapsedSeconds(currentElapsed);
			}, 1000);
		} else if (timeEntry.status === "paused") {
			// For paused entries, calculate the elapsed time up until the pause
			if (timeEntry.pauseStartTime) {
				const startDate = new Date(timeEntry.clockInTime);
				const pauseDate = new Date(timeEntry.pauseStartTime);

				// Account for any previous pause time
				const pauseOffset = timeEntry.totalPausedSeconds || 0;

				const pausedElapsed =
					differenceInSeconds(pauseDate, startDate) - pauseOffset;
				setElapsedSeconds(pausedElapsed);
			}
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [
		timeEntry.status,
		timeEntry.clockInTime,
		timeEntry.pauseStartTime,
		timeEntry.totalPausedSeconds,
	]);

	// Calculate hours and minutes
	const getDurationValues = (totalSeconds) => {
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return { hours, minutes, seconds };
	};

	// For completed entries, use the stored duration (in seconds)
	// For active/paused entries, use the elapsed seconds
	const duration =
		timeEntry.status === "active" || timeEntry.status === "paused"
			? getDurationValues(Math.max(0, elapsedSeconds))
			: getDurationValues(timeEntry.duration || 0);

	// Format duration string with seconds for active entries
	const formatDurationString = (h, m, s, isActive, isPaused) => {
		if (isActive) {
			return `${h > 0 ? `${h}h ` : ""}${
				m > 0 || h > 0 ? `${m}m ` : ""
			}${s}s${isPaused ? " (paused)" : ""}`;
		} else {
			// For completed entries, don't show seconds
			// Convert to decimal hours with one decimal place
			const decimalHours = (h + m / 60).toFixed(2);
			return `${decimalHours}h`;
		}
	};

	const durationString = formatDurationString(
		duration.hours,
		duration.minutes,
		duration.seconds,
		timeEntry.status === "active" || timeEntry.status === "paused",
		timeEntry.status === "paused",
	);

	// Status color
	const getStatusColor = () => {
		switch (timeEntry.status) {
			case "active":
				return "#ff9500";
			case "paused":
				return "#FFA500"; // Different orange for paused
			case "pending_approval":
				return "#FFA500"; // Orange for pending
			case "edited":
				return "#007AFF";
			case "rejected":
				return "#FF3B30"; // Red for rejected
			default:
				return "#34C759";
		}
	};

	// Handler for submission button
	const handleSubmit = (e) => {
		e.stopPropagation(); // Prevent triggering card's onPress
		if (onSubmit) onSubmit(timeEntry);
	};

	return (
		<TouchableOpacity
			style={styles.card}
			onPress={canSubmit && onSubmit ? handleSubmit : onPress}
			activeOpacity={onPress ? 0.7 : 1}
		>
			{/* Date */}
			<View style={styles.dateRow}>
				<Text style={styles.date}>{formattedDate}</Text>
				<View
					style={[
						styles.statusIndicator,
						{ backgroundColor: getStatusColor() },
					]}
				/>
			</View>

			{/* Time information */}
			<View style={styles.timeRow}>
				<View style={styles.timeBlock}>
					<Icon
						name="clock-time-four-outline"
						size={16}
						color="#666"
						style={styles.icon}
					/>
					<View>
						<Text style={styles.timeLabel}>Clock In</Text>
						<Text style={styles.timeValue}>{clockInTime}</Text>
					</View>
				</View>

				<View style={styles.arrow}>
					<Icon name="arrow-right" size={16} color="#999" />
				</View>

				<View style={styles.timeBlock}>
					<Icon
						name={
							timeEntry.clockOutTime
								? "clock-time-nine-outline"
								: "clock-outline"
						}
						size={16}
						color="#666"
						style={styles.icon}
					/>
					<View>
						<Text style={styles.timeLabel}>Clock Out</Text>
						<Text
							style={[
								styles.timeValue,
								timeEntry.status === "active" &&
									styles.activeText,
							]}
						>
							{clockOutTime}
						</Text>
					</View>
				</View>
			</View>

			{/* Duration */}
			<View style={styles.durationRow}>
				<Icon
					name="timer-outline"
					size={16}
					color="#666"
					style={styles.icon}
				/>
				<Text style={styles.durationLabel}>Duration:</Text>
				<Text style={styles.durationValue}>{durationString}</Text>
			</View>

			{/* Event information */}
			{timeEntry.eventTitle && (
				<View style={styles.eventRow}>
					<Icon
						name="calendar-check"
						size={16}
						color="#007AFF"
						style={styles.icon}
					/>
					<Text style={styles.eventLabel}>Event:</Text>
					<Text
						style={styles.eventValue}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{timeEntry.eventTitle}
					</Text>
				</View>
			)}

			{/* Status badges and submit button */}
			{canSubmit && onSubmit ? (
				<View style={styles.submitButton}>
					<Icon
						name="check-circle-outline"
						size={16}
						color="#007AFF"
						style={styles.icon}
					/>
					<Text style={styles.submitText}>Submit for Approval</Text>
				</View>
			) : null}
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	card: {
		backgroundColor: "white",
		borderRadius: 10,
		padding: 16,
		marginBottom: 12,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
		borderWidth: 1,
		borderColor: "#eaeaea",
	},
	dateRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
	},
	date: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	statusIndicator: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	timeRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
	},
	timeBlock: {
		flexDirection: "row",
		alignItems: "center",
	},
	arrow: {
		padding: 8,
	},
	icon: {
		marginRight: 6,
	},
	timeLabel: {
		fontSize: 12,
		color: "#666",
	},
	timeValue: {
		fontSize: 14,
		fontWeight: "500",
		color: "#333",
	},
	activeText: {
		color: "#ff9500",
		fontWeight: "600",
	},
	durationRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	durationLabel: {
		fontSize: 14,
		color: "#666",
		marginRight: 6,
	},
	durationValue: {
		fontSize: 15,
		fontWeight: "600",
		color: "#333",
	},
	eventRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 8,
	},
	eventLabel: {
		fontSize: 14,
		color: "#666",
		marginRight: 6,
	},
	eventValue: {
		fontSize: 15,
		color: "#007AFF",
		flex: 1,
	},
	// Submit button and status badge styles
	submitButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#f0f7ff",
		paddingVertical: 8,
		borderRadius: 6,
		marginTop: 12,
	},
	submitText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#007AFF",
	},
	statusBadge: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#fff8e1",
		paddingVertical: 8,
		borderRadius: 6,
		marginTop: 12,
	},
	pendingText: {
		fontSize: 14,
		fontWeight: "500",
		color: "#FFA500",
	},
});

export default TimeEntryCard;
