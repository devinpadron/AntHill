import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { format, parseISO } from "date-fns";

import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useNetwork } from "../../contexts/NetworkContext";
import {
	clockIn,
	clockOut,
	pauseTimeEntry,
	subscribeToActiveTimeEntry,
} from "../../services/timeEntryService";
import { fetchUpcomingEventsForUser } from "../../services/availabilityService";

import { TopBar } from "../../components/ui/TopBar";
import { Text } from "../../components/ui/Text";
import { ActiveClockCard } from "../../components/today/ActiveClockCard";
import { NotClockedInCard } from "../../components/today/NotClockedInCard";
import { UpNextCard } from "../../components/today/UpNextCard";
import { QuickAction } from "../../components/today/QuickAction";
import { SectionHeader } from "../../components/today/SectionHeader";
import { OfflineBar } from "../../components/ui/OfflineBar";
import { CompanySwitcherSheet } from "../../components/ui/CompanySwitcherSheet";
import { FontFamily } from "../../constants/tokens";

const TodayScreen: React.FC = () => {
	const navigation = useNavigation<any>();
	const { theme } = useTheme();
	const { user, userId, companyId } = useUser();
	const { companyData } = useCompany();
	const { isConnected } = useNetwork();

	const [activeEntry, setActiveEntry] = useState<any | null>(null);
	const [nextEvent, setNextEvent] = useState<any | null>(null);
	const [companySwitcherOpen, setCompanySwitcherOpen] = useState(false);

	// Active time entry subscription
	useEffect(() => {
		if (!userId || !companyId) return;
		const unsub = subscribeToActiveTimeEntry(userId, companyId, (entry) => {
			setActiveEntry(entry);
		});
		return () => unsub?.();
	}, [userId, companyId]);

	// Next upcoming event for this user
	useEffect(() => {
		if (!userId || !companyId) return;
		let cancelled = false;
		(async () => {
			try {
				const events = await fetchUpcomingEventsForUser(
					companyId,
					userId,
				);
				if (cancelled) return;
				const sorted = [...events].sort((a, b) =>
					(a as any).date < (b as any).date ? -1 : 1,
				);
				setNextEvent(sorted[0] ?? null);
			} catch {
				if (!cancelled) setNextEvent(null);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [userId, companyId]);

	const greeting = useMemo(() => {
		const h = new Date().getHours();
		if (h < 12) return "Good morning";
		if (h < 17) return "Good afternoon";
		return "Good evening";
	}, []);

	const firstName: string = user?.firstName ?? user?.displayName ?? "there";
	const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
	const todayDateLabel = format(new Date(), "EEEE · MMMM d").toUpperCase();

	const handleClockIn = useCallback(async () => {
		if (!userId || !companyId) return;
		try {
			await clockIn(userId, companyId);
		} catch (e) {
			console.error("clockIn failed", e);
		}
	}, [userId, companyId]);

	const handleClockOut = useCallback(async () => {
		if (!companyId || !activeEntry?.id) return;
		try {
			await clockOut(activeEntry.id, companyId);
		} catch (e) {
			console.error("clockOut failed", e);
		}
	}, [companyId, activeEntry]);

	const handlePause = useCallback(async () => {
		if (!companyId || !activeEntry?.id) return;
		try {
			await pauseTimeEntry(activeEntry.id, companyId);
		} catch (e) {
			console.error("pause failed", e);
		}
	}, [companyId, activeEntry]);

	const nextEventBlock = (() => {
		if (!nextEvent) return null;
		let day: string;
		let dayNum: string;
		try {
			const d = parseISO(nextEvent.date);
			day = format(d, "EEE").toUpperCase();
			dayNum = format(d, "d");
		} catch {
			day = "—";
			dayNum = "—";
		}
		const workerNames: string[] = (nextEvent.assignedWorkers ?? []).slice(
			0,
			4,
		);
		const extra = Math.max(0, (nextEvent.assignedWorkers?.length ?? 0) - 4);
		const range =
			nextEvent.startTime && nextEvent.endTime
				? `${nextEvent.startTime} – ${nextEvent.endTime}`
				: (nextEvent.startTime ?? undefined);
		const locationText = nextEvent.locations
			? Object.keys(nextEvent.locations)[0]
			: undefined;
		return (
			<UpNextCard
				dayLabel={day}
				dayNumber={dayNum}
				tone="terra"
				tag={nextEvent.label}
				durationLabel={
					nextEvent.duration ? `${nextEvent.duration}` : undefined
				}
				title={nextEvent.title ?? "Upcoming shift"}
				timeRange={range}
				location={locationText}
				workerNames={workerNames}
				extraWorkers={extra}
				onPress={() =>
					navigation.navigate("Calendar", {
						screen: "Details",
						params: { eventID: nextEvent.id },
					})
				}
			/>
		);
	})();

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
					name={fullName || firstName}
					companyName={companyData?.name ?? ""}
					unread={0}
					onPressCompany={() => setCompanySwitcherOpen(true)}
					onPressBell={() => navigation.navigate("Notifications")}
					onPressAvatar={() => navigation.navigate("Settings")}
				/>

				{!isConnected && <OfflineBar />}

				{/* Greeting */}
				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 14,
						paddingBottom: 18,
					}}
				>
					<Text variant="eyebrow" color="tertiary">
						{todayDateLabel}
					</Text>
					<View style={{ flexDirection: "column", marginTop: 6 }}>
						<Text
							variant="displayLg"
							style={{
								fontFamily: FontFamily.display,
								lineHeight: 40,
							}}
						>
							{greeting},
						</Text>
						<Text
							variant="displayLg"
							color="accent"
							italic
							style={{ lineHeight: 40 }}
						>
							{firstName}.
						</Text>
					</View>
				</View>

				{/* Active clock card or clock-in prompt */}
				<View style={{ paddingHorizontal: 16 }}>
					{activeEntry ? (
						<ActiveClockCard
							clockInAt={activeEntry.clockInTime}
							location={
								nextEvent?.locations
									? Object.keys(nextEvent.locations)[0]
									: undefined
							}
							eventTitle={nextEvent?.title}
							onPause={handlePause}
							onClockOut={handleClockOut}
						/>
					) : (
						<NotClockedInCard
							nextShiftLabel={
								nextEvent ? "Shift starts" : "Nothing scheduled"
							}
							nextShiftAccent={
								nextEvent?.startTime
									? nextEvent.startTime
									: undefined
							}
							subtitle={
								nextEvent
									? `${nextEvent.title}${
											nextEvent.locations
												? " · " +
													Object.keys(
														nextEvent.locations,
													)[0]
												: ""
										}`
									: "You don't have any upcoming shifts."
							}
							onClockIn={handleClockIn}
						/>
					)}
				</View>

				{/* Up next */}
				{nextEventBlock && (
					<>
						<SectionHeader title="Up next" trailing="See all" />
						<View style={{ paddingHorizontal: 16 }}>
							{nextEventBlock}
						</View>
					</>
				)}

				{/* Quick actions */}
				<SectionHeader title="Quick actions" />
				<View
					style={{
						paddingHorizontal: 16,
						flexDirection: "row",
						flexWrap: "wrap",
						gap: 10,
					}}
				>
					<View style={{ flexBasis: "48%", flexGrow: 1 }}>
						<QuickAction
							icon="cal"
							label="My schedule"
							sub="Next 7 days"
							onPress={() => navigation.navigate("Calendar")}
						/>
					</View>
					<View style={{ flexBasis: "48%", flexGrow: 1 }}>
						<QuickAction
							icon="clock"
							label="Timesheet"
							sub="This week"
							onPress={() => navigation.navigate("Clock")}
						/>
					</View>
					<View style={{ flexBasis: "48%", flexGrow: 1 }}>
						<QuickAction
							icon="doc"
							label="Submit hours"
							sub="Pending review"
							onPress={() => navigation.navigate("Clock")}
						/>
					</View>
					<View style={{ flexBasis: "48%", flexGrow: 1 }}>
						<QuickAction
							icon="user"
							label="My profile"
							sub="Account & prefs"
							onPress={() => navigation.navigate("Settings")}
						/>
					</View>
				</View>
				<View style={{ height: 24 }} />
			</ScrollView>

			<CompanySwitcherSheet
				visible={companySwitcherOpen}
				onClose={() => setCompanySwitcherOpen(false)}
			/>
		</SafeAreaView>
	);
};

export default TodayScreen;
