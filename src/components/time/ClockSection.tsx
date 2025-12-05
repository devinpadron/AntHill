import React from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { format } from "date-fns";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { Spacer } from "../ui/Spacer";
import { useTheme } from "../../contexts/ThemeContext";
import { TimeEntry } from "../../types";

interface ClockSectionProps {
	activeTimeEntry: TimeEntry | null;
	isPaused: boolean;
	isPausingOrResuming: boolean;
	onClockIn: () => void;
	onClockOut: () => void;
	onPause: () => void;
	onResume: () => void;
}

/**
 * ClockSection - Clock in/out controls and active timer display
 *
 * Shows:
 * - Current clock status (clocked in, paused, or not clocked in)
 * - Clock in/out buttons
 * - Pause/resume controls when clocked in
 */
export const ClockSection: React.FC<ClockSectionProps> = ({
	activeTimeEntry,
	isPaused,
	isPausingOrResuming,
	onClockIn,
	onClockOut,
	onPause,
	onResume,
}) => {
	const { theme } = useTheme();

	return (
		<Card padding="lg" style={styles.card}>
			{activeTimeEntry ? (
				<>
					<View style={styles.statusRow}>
						<Icon
							name={isPaused ? "pause-circle" : "clock-outline"}
							size={24}
							color={isPaused ? "#FFA500" : theme.LocationBlue}
							style={styles.statusIcon}
						/>
						<Text
							variant="body"
							weight="medium"
							style={{
								color: isPaused
									? "#FFA500"
									: theme.LocationBlue,
							}}
						>
							{isPaused ? "Timer paused" : "Clocked in at"}{" "}
							{format(
								new Date(activeTimeEntry.clockInTime),
								"h:mm a",
							)}
						</Text>
					</View>

					<Spacer size="md" />

					<View style={styles.buttonColumn}>
						{isPausingOrResuming ? (
							<Button
								title={isPaused ? "RESUMING..." : "PAUSING..."}
								variant="secondary"
								disabled
								loading
								style={styles.button}
								onPress={() => {}}
							/>
						) : isPaused ? (
							<Button
								title="RESUME"
								variant="primary"
								onPress={onResume}
								icon={
									<Icon name="play" size={18} color="white" />
								}
								style={[
									styles.button,
									{
										backgroundColor:
											theme.NotificationGreen,
									},
								]}
							/>
						) : (
							<Button
								title="PAUSE"
								variant="secondary"
								onPress={onPause}
								icon={
									<Icon
										name="pause"
										size={18}
										color="white"
									/>
								}
								style={[
									styles.button,
									{ backgroundColor: "#FFA500" },
								]}
							/>
						)}

						<Spacer size="sm" />

						<Button
							title="CLOCK OUT"
							variant="destructive"
							onPress={onClockOut}
							disabled={isPausingOrResuming}
							icon={
								<Icon
									name="logout-variant"
									size={18}
									color="white"
								/>
							}
							style={styles.button}
						/>
					</View>
				</>
			) : (
				<>
					<View style={styles.statusRow}>
						<Icon
							name="clock-outline"
							size={24}
							color={theme.TertiaryText}
							style={styles.statusIcon}
						/>
						<Text variant="body" color="secondary">
							Not clocked in
						</Text>
					</View>

					<Spacer size="md" />

					<Button
						title="CLOCK IN"
						variant="primary"
						onPress={onClockIn}
						icon={
							<Icon
								name="login-variant"
								size={18}
								color="white"
							/>
						}
						style={[
							styles.button,
							{ backgroundColor: theme.NotificationGreen },
						]}
					/>
				</>
			)}
		</Card>
	);
};

const styles = StyleSheet.create({
	card: {
		marginVertical: 8,
		width: "100%",
		alignItems: "center",
	},
	statusRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	statusIcon: {
		marginRight: 8,
	},
	buttonColumn: {
		width: "100%",
	},
	button: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
	},
});
