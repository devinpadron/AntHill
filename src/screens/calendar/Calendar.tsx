import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	addDays,
	format,
	isSameDay,
	isToday as isDateToday,
	parseISO,
} from "date-fns";

import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useNetwork } from "../../contexts/NetworkContext";
import { subscribeAllEvents } from "../../services/eventService";

import { TopBar } from "../../components/ui/TopBar";
import { Text } from "../../components/ui/Text";
import { Icon } from "../../components/ui/Icon";
import { OfflineBar } from "../../components/ui/OfflineBar";
import { CompanySwitcherSheet } from "../../components/ui/CompanySwitcherSheet";
import { MonthGrid, colorForLabel } from "../../components/calendar/MonthGrid";
import { EventRow } from "../../components/calendar/EventRow";
import { Cream, Olive } from "../../constants/colors";
import { BorderRadius, Shadow } from "../../constants/tokens";

type ViewMode = "Month" | "Week" | "List";

const CalendarScreen = ({ navigation }: { navigation: any }) => {
	const { theme } = useTheme();
	const { user } = useUser();
	const { companyData } = useCompany();
	const { isConnected } = useNetwork();
	const companyId = companyData?.id;

	const [events, setEvents] = useState<any[]>([]);
	const [selectedDate, setSelectedDate] = useState<Date>(new Date());
	const [month] = useState<Date>(new Date());
	const [view, setView] = useState<ViewMode>("Month");
	const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);

	useEffect(() => {
		if (!companyId) return;
		const unsub = subscribeAllEvents(companyId, (snapshot) => {
			const list: any[] = [];
			snapshot.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
			setEvents(list);
		});
		return () => unsub?.();
	}, [companyId]);

	const eventsByDate = useMemo(() => {
		const map: Record<string, { color: string }[]> = {};
		for (const ev of events) {
			if (!ev.date) continue;
			const arr = (map[ev.date] ??= []);
			arr.push({ color: colorForLabel(ev.label) });
		}
		return map;
	}, [events]);

	const today = new Date();
	const selectedIso = format(selectedDate, "yyyy-MM-dd");
	const tomorrowIso = format(addDays(today, 1), "yyyy-MM-dd");

	const selectedDayEvents = events
		.filter((e) => e.date === selectedIso)
		.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

	const tomorrowEvents = events
		.filter((e) => e.date === tomorrowIso)
		.sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));

	const totalShifts = events.length;

	const renderEvent = (e: any) => {
		const locationText = e.locations
			? Object.keys(e.locations)[0]
			: undefined;
		const range =
			e.startTime && e.endTime ? `${e.startTime}` : (e.startTime ?? "");
		const isNow =
			isDateToday(parseISO(e.date)) &&
			(() => {
				try {
					const start = parseISO(`${e.date}T${e.startTime}`);
					const end = e.endTime
						? parseISO(`${e.date}T${e.endTime}`)
						: null;
					return end ? today >= start && today <= end : false;
				} catch {
					return false;
				}
			})();
		return (
			<EventRow
				key={e.id}
				time={range}
				durationLabel={e.duration ?? undefined}
				title={e.title ?? "Untitled event"}
				location={locationText}
				tone={"olive"}
				tag={e.label || undefined}
				current={isNow}
				onPress={() =>
					navigation.navigate("Details", { eventID: e.id })
				}
			/>
		);
	};

	return (
		<SafeAreaView
			edges={["top"]}
			style={{ flex: 1, backgroundColor: theme.Background }}
		>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 140 }}
				showsVerticalScrollIndicator={false}
			>
				<TopBar
					name={
						`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() ||
						"You"
					}
					companyName={companyData?.name ?? ""}
					onPressCompany={() => setCompanySwitcherOpen(true)}
					onPressBell={() => navigation.navigate("Notifications")}
					onPressAvatar={() => navigation.navigate("Settings")}
				/>

				{!isConnected && <OfflineBar />}

				{/* Header row: filter + search */}
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
					<TouchableOpacity
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 6,
						}}
					>
						<Icon
							name="filter"
							size={16}
							color={theme.SecondaryText}
						/>
						<Text variant="caption" color="secondary">
							All labels
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={{
							width: 36,
							height: 36,
							borderRadius: 18,
							backgroundColor: theme.Surface,
							borderWidth: 0.5,
							borderColor: theme.BorderColor,
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon
							name="search"
							size={17}
							color={theme.PrimaryText}
						/>
					</TouchableOpacity>
				</View>

				{/* Month title */}
				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 10,
						paddingBottom: 12,
					}}
				>
					<Text variant="eyebrow" color="tertiary">
						{format(month, "MMMM · yyyy")}
					</Text>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							marginTop: 4,
						}}
					>
						<Text variant="display">{totalShifts}</Text>
						<Text variant="display" color="tertiary">
							{" "}
							shifts
						</Text>
					</View>
				</View>

				{/* Segment toggle */}
				<View
					style={{
						paddingHorizontal: 20,
						paddingBottom: 12,
						flexDirection: "row",
					}}
				>
					<View
						style={{
							flexDirection: "row",
							backgroundColor: theme.Surface2,
							padding: 3,
							borderRadius: 999,
							gap: 2,
						}}
					>
						{(["Month", "Week", "List"] as ViewMode[]).map((l) => {
							const active = l === view;
							return (
								<TouchableOpacity
									key={l}
									onPress={() => setView(l)}
									style={{
										paddingVertical: 6,
										paddingHorizontal: 14,
										borderRadius: 999,
										backgroundColor: active
											? theme.Surface
											: "transparent",
										...(active ? Shadow.sm : {}),
									}}
								>
									<Text
										variant="small"
										weight="semibold"
										style={{
											color: active
												? theme.PrimaryText
												: theme.SecondaryText,
											fontSize: 12.5,
										}}
									>
										{l}
									</Text>
								</TouchableOpacity>
							);
						})}
					</View>
				</View>

				{/* Month grid */}
				{view === "Month" && (
					<MonthGrid
						month={month}
						today={today}
						selectedDate={selectedDate}
						eventsByDate={eventsByDate}
						onSelectDate={setSelectedDate}
					/>
				)}

				{/* Selected day */}
				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 22,
						paddingBottom: 8,
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "baseline",
					}}
				>
					<View>
						<Text
							variant="eyebrow"
							color={
								isDateToday(selectedDate) ? "warm" : "tertiary"
							}
						>
							{isDateToday(selectedDate)
								? "Today"
								: format(selectedDate, "EEEE")}
						</Text>
						<Text variant="h3" style={{ marginTop: 4 }}>
							{format(selectedDate, "EEEE, MMMM d")}
						</Text>
					</View>
					<Text variant="mono" color="tertiary">
						{selectedDayEvents.length} event
						{selectedDayEvents.length === 1 ? "" : "s"}
					</Text>
				</View>

				<View
					style={{
						paddingHorizontal: 16,
						flexDirection: "column",
						gap: 8,
					}}
				>
					{selectedDayEvents.length === 0 ? (
						<View style={{ padding: 24, alignItems: "center" }}>
							<Text variant="caption" color="tertiary">
								Nothing scheduled.
							</Text>
						</View>
					) : (
						selectedDayEvents.map(renderEvent)
					)}
				</View>

				{/* Tomorrow */}
				{tomorrowEvents.length > 0 && (
					<>
						<View
							style={{
								paddingHorizontal: 22,
								paddingTop: 20,
								paddingBottom: 8,
							}}
						>
							<Text
								variant="caption"
								weight="semibold"
								color="primary"
							>
								Tomorrow
							</Text>
						</View>
						<View
							style={{
								paddingHorizontal: 16,
								flexDirection: "column",
								gap: 8,
							}}
						>
							{tomorrowEvents.map(renderEvent)}
						</View>
					</>
				)}

				<View style={{ height: 24 }} />
			</ScrollView>

			<CompanySwitcherSheet
				visible={companySwitcherOpen}
				onClose={() => setCompanySwitcherOpen(false)}
			/>
		</SafeAreaView>
	);
};

export default CalendarScreen;
