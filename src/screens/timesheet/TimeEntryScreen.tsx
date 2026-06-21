import React, { useMemo, useState, useCallback } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import {
	addDays,
	differenceInCalendarDays,
	endOfDay,
	format,
	parseISO,
	startOfDay,
} from "date-fns";

import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useNetwork } from "../../contexts/NetworkContext";

import { useDateRange } from "../../hooks/timesheet/useDateRange";
import { useTimeEntries } from "../../hooks/timesheet/useTimeEntries";
import { useActiveTimeEntry } from "../../hooks/timesheet/useActiveTimeEntry";
import { useClockActions } from "../../hooks/timesheet/useClockActions";
import { submitTimeEntryForApproval } from "../../services/timeEntryService";
import { TimeEntry } from "../../types";

import { TimeEntrySubmitModal } from "../../components/time";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Divider } from "../../components/ui/Divider";
import { TopBar } from "../../components/ui/TopBar";
import { OfflineBar } from "../../components/ui/OfflineBar";
import { CompanySwitcherSheet } from "../../components/ui/CompanySwitcherSheet";
import { WeekChart, WeekChartDay } from "../../components/time/WeekChart";
import { EntryRow } from "../../components/time/EntryRow";
import { ActiveClockCard } from "../../components/today/ActiveClockCard";
import { NotClockedInCard } from "../../components/today/NotClockedInCard";

import { FontFamily } from "../../constants/tokens";

const TARGET_HOURS_PER_WEEK = 40;

const TimeEntryScreen = ({ navigation }: { navigation: any }) => {
	const { theme } = useTheme();
	const { userId, user } = useUser();
	const { companyData, preferences } = useCompany();
	const { isConnected } = useNetwork();
	const companyId = companyData?.id;

	const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);

	const dateRange = useDateRange({
		workWeekStarts: preferences?.workWeekStarts,
	});

	const { timeEntries, refetch } = useTimeEntries({
		startDate: dateRange.currentStartDate,
		endDate: dateRange.currentEndDate,
	});

	const { activeTimeEntry } = useActiveTimeEntry();
	const { clockIn, clockOut, pauseTimer } = useClockActions();

	const [submitModalVisible, setSubmitModalVisible] = useState(false);
	const [selectedTimeEntry, setSelectedTimeEntry] =
		useState<TimeEntry | null>(null);

	useFocusEffect(
		useCallback(() => {
			refetch();
			setSubmitModalVisible(false);
		}, [dateRange.currentStartDate, dateRange.currentEndDate, refetch]),
	);

	// Build per-day worked hours for the chart
	const chartDays: WeekChartDay[] = useMemo(() => {
		const start = startOfDay(dateRange.currentStartDate);
		const end = endOfDay(dateRange.currentEndDate);
		const numDays = differenceInCalendarDays(end, start) + 1;
		const today = startOfDay(new Date());

		const buckets: number[] = Array.from({ length: numDays }, () => 0);
		for (const e of timeEntries) {
			if (!e.clockInTime) continue;
			const d = parseISO(e.clockInTime);
			const idx = differenceInCalendarDays(d, start);
			if (idx < 0 || idx >= numDays) continue;
			buckets[idx] += (e.duration ?? 0) / 3600;
		}

		return buckets.map((hrs, i) => {
			const d = addDays(start, i);
			return {
				label: format(d, "EEEEE"), // single letter
				workedHours: hrs,
				active: format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"),
			};
		});
	}, [timeEntries, dateRange.currentStartDate, dateRange.currentEndDate]);

	const totalSeconds = useMemo(
		() => timeEntries.reduce((acc, e) => acc + (e.duration ?? 0), 0),
		[timeEntries],
	);
	const totalHours = Math.floor(totalSeconds / 3600);
	const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

	const totalThisWeekHrs = totalSeconds / 3600;
	const onTrack = totalThisWeekHrs >= 0;
	const overtimeHours = Math.max(0, totalThisWeekHrs - TARGET_HOURS_PER_WEEK);

	const handleClockOut = useCallback(async () => {
		setSelectedTimeEntry(activeTimeEntry);
		setSubmitModalVisible(true);
	}, [activeTimeEntry]);

	const handleSubmitTimeEntry = async (
		timeEntryId: string,
		entry: TimeEntry,
	) => {
		if (!timeEntryId || !companyId) {
			throw new Error("Missing required data for submission");
		}
		const isActiveEntry =
			activeTimeEntry && activeTimeEntry.id === timeEntryId;
		if (isActiveEntry) {
			await clockOut(activeTimeEntry.id);
		}
		await submitTimeEntryForApproval(timeEntryId, companyId, entry);
		refetch();
	};

	const recentEntries = useMemo(
		() =>
			[...timeEntries].sort((a, b) =>
				a.clockInTime < b.clockInTime ? 1 : -1,
			),
		[timeEntries],
	);

	const weekLabel = `Week of ${format(dateRange.currentStartDate, "MMM d")}`;
	const fullName =
		`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "You";

	return (
		<SafeAreaView
			edges={["top"]}
			style={{ flex: 1, backgroundColor: theme.Background }}
		>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 120 }}
				showsVerticalScrollIndicator={false}
			>
				<TopBar
					name={fullName}
					companyName={companyData?.name ?? ""}
					onPressCompany={() => setCompanySwitcherOpen(true)}
					onPressBell={() => navigation.navigate("Notifications")}
					onPressAvatar={() => navigation.navigate("Settings")}
				/>

				{!isConnected && <OfflineBar />}

				{/* Header */}
				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 6,
						paddingBottom: 4,
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<Text variant="eyebrow" color="tertiary">
						{weekLabel}
					</Text>
					<View style={{ flexDirection: "row", gap: 4 }}>
						<NavButton
							icon="chevL"
							onPress={dateRange.goToPrevWeek}
						/>
						<NavButton
							icon="chev"
							onPress={dateRange.goToNextWeek}
						/>
					</View>
				</View>

				{/* Total */}
				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 10,
						paddingBottom: 18,
					}}
				>
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							flexWrap: "wrap",
						}}
					>
						<Text
							style={{
								fontFamily: FontFamily.display,
								fontSize: 56,
								color: theme.PrimaryText,
								lineHeight: 56,
							}}
						>
							{totalHours}
						</Text>
						<Text
							style={{
								fontFamily: FontFamily.display,
								fontSize: 32,
								color: theme.TertiaryText,
								lineHeight: 56,
							}}
						>
							h
						</Text>
						<Text
							style={{
								fontFamily: FontFamily.display,
								fontSize: 56,
								color: theme.PrimaryText,
								lineHeight: 56,
								marginLeft: 10,
							}}
						>
							{totalMinutes}
						</Text>
						<Text
							style={{
								fontFamily: FontFamily.display,
								fontSize: 32,
								color: theme.TertiaryText,
								lineHeight: 56,
							}}
						>
							m
						</Text>
					</View>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 6,
							marginTop: 6,
						}}
					>
						<Text variant="caption" color="secondary">
							of
						</Text>
						<Text
							style={{
								fontFamily: FontFamily.mono,
								fontSize: 13,
								color: theme.SecondaryText,
							}}
						>
							{TARGET_HOURS_PER_WEEK} h
						</Text>
						<Text variant="caption" color="secondary">
							target ·
						</Text>
						<Text
							variant="caption"
							color="accent"
							weight="semibold"
						>
							{onTrack ? "on track" : "behind"}
						</Text>
					</View>
				</View>

				{/* Chart */}
				<View style={{ paddingHorizontal: 16 }}>
					<WeekChart days={chartDays} overtimeHours={overtimeHours} />
				</View>

				{/* Clock card */}
				<View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
					{activeTimeEntry ? (
						<ActiveClockCard
							clockInAt={activeTimeEntry.clockInTime}
							onPause={() =>
								activeTimeEntry &&
								pauseTimer(activeTimeEntry.id)
							}
							onClockOut={handleClockOut}
						/>
					) : (
						<NotClockedInCard
							nextShiftLabel="Ready when you are"
							subtitle="Tap to start tracking time."
							onClockIn={clockIn}
						/>
					)}
				</View>

				{/* Recent entries */}
				<View
					style={{
						paddingHorizontal: 22,
						paddingTop: 22,
						paddingBottom: 10,
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "baseline",
					}}
				>
					<Text variant="h3" weight="semibold">
						Recent entries
					</Text>
					<TouchableOpacity
						onPress={() =>
							navigation.navigate("TimeEntryDetails", {
								entryId: timeEntries.map((e) => e.id),
								userId,
							})
						}
						hitSlop={8}
					>
						<Text variant="small" color="tertiary">
							All entries
						</Text>
					</TouchableOpacity>
				</View>

				<View style={{ paddingHorizontal: 16 }}>
					<Card padding="none">
						{recentEntries.length === 0 ? (
							<View style={{ padding: 28, alignItems: "center" }}>
								<Text variant="caption" color="tertiary">
									No time entries this week.
								</Text>
							</View>
						) : (
							recentEntries.map((e, i) => {
								const overtime = (e.duration ?? 0) > 8 * 3600;
								return (
									<View key={e.id ?? `${e.clockInTime}-${i}`}>
										<EntryRow
											clockInAt={e.clockInTime}
											clockOutAt={e.clockOutTime}
											durationSeconds={e.duration}
											status={e.status}
											overtime={overtime}
											onPress={() =>
												navigation.navigate(
													"TimeEntryDetails",
													{ entryId: e.id, userId },
												)
											}
										/>
										{i < recentEntries.length - 1 && (
											<Divider inset={20} soft />
										)}
									</View>
								);
							})
						)}
					</Card>
				</View>

				<View style={{ height: 24 }} />
			</ScrollView>

			<TimeEntrySubmitModal
				visible={submitModalVisible}
				timeEntry={selectedTimeEntry}
				onClose={() => setSubmitModalVisible(false)}
				onSubmit={handleSubmitTimeEntry}
			/>

			<CompanySwitcherSheet
				visible={companySwitcherOpen}
				onClose={() => setCompanySwitcherOpen(false)}
			/>
		</SafeAreaView>
	);
};

function NavButton({
	icon,
	onPress,
}: {
	icon: "chev" | "chevL";
	onPress: () => void;
}) {
	const { theme } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			style={{
				width: 32,
				height: 32,
				borderRadius: 16,
				backgroundColor: theme.Surface,
				borderWidth: 0.5,
				borderColor: theme.BorderColor,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<Icon name={icon} size={16} color={theme.PrimaryText} />
		</TouchableOpacity>
	);
}

export default TimeEntryScreen;
