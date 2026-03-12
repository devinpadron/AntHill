import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DatePicker from "react-native-date-picker";
import moment from "moment";
import { Text } from "../ui/Text";
import { Checkbox } from "../ui/Checkbox";
import { useTheme } from "../../contexts/ThemeContext";
import {
	Spacing,
	BorderRadius,
	FontSize,
	IconSize,
} from "../../constants/tokens";

type DateTimeSectionProps = {
	date: Date;
	allDay: boolean;
	startTime: Date;
	hasEndTime: boolean;
	endTime: Date;
	openDate: boolean;
	openStartTime: boolean;
	openEndTime: boolean;
	onToggleDatePicker: (picker: string) => void;
	onToggleAllDay: () => void;
	onToggleEndTime: () => void;
	onDateChange: (d: Date) => void;
	onStartTimeChange: (d: Date) => void;
	onEndTimeChange: (d: Date) => void;
};

const formatDate = (date: Date) => moment(date).format("MMM D, YYYY");
const formatTime = (time: Date, start: boolean = true) => {
	if (start) return moment(time).format("h:mm A");
	return moment(time).format("MMMM D, h:mm A");
};

export const DateTimeSection = ({
	date,
	allDay,
	startTime,
	hasEndTime,
	endTime,
	openDate,
	openStartTime,
	openEndTime,
	onToggleDatePicker,
	onToggleAllDay,
	onToggleEndTime,
	onDateChange,
	onStartTimeChange,
	onEndTimeChange,
}: DateTimeSectionProps) => {
	const { theme } = useTheme();

	const dateButtonStyle = [
		styles.dateButton,
		{
			backgroundColor: theme.CardBackground,
			borderColor: theme.BorderColor,
		},
	];

	return (
		<View
			style={[styles.section, { borderBottomColor: theme.BorderColor }]}
		>
			<Text
				variant="h3"
				weight="bold"
				color="primary"
				style={styles.sectionTitle}
			>
				Date & Time
			</Text>

			{/* Date Toggle */}
			<View style={styles.inputContainer}>
				<Text
					variant="body"
					weight="medium"
					color="secondary"
					style={styles.label}
				>
					Date
				</Text>
				<TouchableOpacity
					onPress={() => onToggleDatePicker("date")}
					style={dateButtonStyle}
				>
					<Text variant="body" color="primary">
						{formatDate(date)}
					</Text>
					<Ionicons
						name="calendar-outline"
						size={IconSize.md}
						color={theme.SecondaryText}
					/>
				</TouchableOpacity>
				<DatePicker
					modal
					open={openDate}
					date={date}
					mode="date"
					onConfirm={(d) => {
						onToggleDatePicker("date");
						onDateChange(d);
					}}
					onCancel={() => onToggleDatePicker("date")}
				/>
			</View>

			<View style={styles.checkboxWrapper}>
				<Checkbox
					checked={allDay}
					onPress={onToggleAllDay}
					label="All Day"
				/>
			</View>

			{!allDay && (
				<View style={styles.timeContainer}>
					{/* Start Time */}
					<View style={[styles.inputContainer, styles.timeField]}>
						<Text
							variant="body"
							weight="medium"
							color="secondary"
							style={styles.label}
						>
							Start Time
						</Text>
						<TouchableOpacity
							onPress={() => onToggleDatePicker("startTime")}
							style={dateButtonStyle}
						>
							<Text variant="body" color="primary">
								{formatTime(startTime)}
							</Text>
							<Ionicons
								name="time-outline"
								size={IconSize.md}
								color={theme.SecondaryText}
							/>
						</TouchableOpacity>
						<DatePicker
							modal
							open={openStartTime}
							date={startTime}
							mode="time"
							onConfirm={(d) => {
								onToggleDatePicker("startTime");
								onStartTimeChange(d);
							}}
							onCancel={() => onToggleDatePicker("startTime")}
						/>
					</View>

					{/* End Time Toggle */}
					<View style={styles.checkboxWrapper}>
						<Checkbox
							checked={hasEndTime}
							onPress={onToggleEndTime}
							label="End Time"
						/>
					</View>

					{hasEndTime && (
						<View style={[styles.inputContainer, styles.timeField]}>
							<Text
								variant="body"
								weight="medium"
								color="secondary"
								style={styles.label}
							>
								End Time
							</Text>
							<TouchableOpacity
								onPress={() => onToggleDatePicker("endTime")}
								style={dateButtonStyle}
							>
								<Text variant="body" color="primary">
									{formatTime(endTime, false)}
								</Text>
								<Ionicons
									name="time-outline"
									size={IconSize.md}
									color={theme.SecondaryText}
								/>
							</TouchableOpacity>
							<DatePicker
								modal
								open={openEndTime}
								date={endTime}
								mode="datetime"
								onConfirm={(d) => {
									onToggleDatePicker("endTime");
									onEndTimeChange(d);
								}}
								onCancel={() => onToggleDatePicker("endTime")}
							/>
						</View>
					)}
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	section: {
		padding: Spacing.lg,
		borderBottomWidth: 1,
	},
	sectionTitle: {
		marginBottom: Spacing.lg,
	},
	inputContainer: {
		marginBottom: Spacing.lg,
	},
	label: {
		marginBottom: Spacing.sm,
	},
	dateButton: {
		padding: Spacing.lg,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	checkboxWrapper: {
		marginBottom: Spacing.lg,
	},
	timeContainer: {
		flexDirection: "column",
	},
	timeField: {
		flex: 1,
	},
});
