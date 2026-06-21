import React, { useCallback, useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, StatusBar } from "react-native";
import {
	RouteProp,
	useFocusEffect,
	useNavigation,
	useRoute,
} from "@react-navigation/native";
import { format, parseISO } from "date-fns";

import { useUser } from "../../contexts/UserContext";
import { useTheme } from "../../contexts/ThemeContext";

import {
	getEvent,
	subscribeEvent,
	subscribeEventChecklist,
} from "../../services/eventService";
import { getUser } from "../../services/userService";

import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { Divider } from "../../components/ui/Divider";
import { Avatar } from "../../components/ui/Avatar";
import { Icon, IconName } from "../../components/ui/Icon";
import { FontFamily, BorderRadius } from "../../constants/tokens";
import { Cream, Olive, Terra, Ink, Amber } from "../../constants/colors";

type Params = { eventID?: string; eventId?: string };

const HERO_HEIGHT = 220;

const EventDetailsScreen: React.FC = () => {
	const { theme } = useTheme();
	const navigation = useNavigation<any>();
	const route = useRoute<RouteProp<Record<string, Params>, string>>();
	const eventId = route.params?.eventID ?? route.params?.eventId;

	const { user, userId } = useUser();
	const companyId = user?.loggedInCompany;

	const [event, setEvent] = useState<any | null>(null);
	const [workers, setWorkers] = useState<
		Array<{ id: string; name: string; status: string }>
	>([]);
	const [checklistStates, setChecklistStates] = useState<
		Record<string, number>
	>({});

	// Live event subscription
	useEffect(() => {
		if (!companyId || !eventId) return;
		const unsub = subscribeEvent(companyId, eventId, (snap) => {
			setEvent(snap.data());
		});
		return () => unsub?.();
	}, [companyId, eventId]);

	// Refetch on focus
	useFocusEffect(
		useCallback(() => {
			if (!companyId || !eventId) return;
			(async () => {
				const e = await getEvent(companyId, eventId);
				if (e) setEvent(e);
			})();
		}, [companyId, eventId]),
	);

	// Resolve worker names + statuses
	useEffect(() => {
		if (!event?.assignedWorkers) return;
		(async () => {
			const list = await Promise.all(
				event.assignedWorkers.map(async (workerId: string) => {
					try {
						const u: any = await getUser(workerId);
						const ws: any[] = event.workerStatus ?? [];
						const found = Array.isArray(ws)
							? ws.find((w: any) => w?.userId === workerId)
							: ws?.[workerId];
						const status = found?.status ?? found ?? "pending";
						return {
							id: workerId,
							name: u
								? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
								: "Worker",
							status,
						};
					} catch {
						return {
							id: workerId,
							name: "Worker",
							status: "pending",
						};
					}
				}),
			);
			setWorkers(list);
		})();
	}, [event]);

	// Per-event checklist completion state (item id → 0/1/2)
	useEffect(() => {
		if (!companyId || !eventId) return;
		let unsub: any;
		(async () => {
			try {
				unsub = await subscribeEventChecklist(
					companyId,
					eventId,
					(snap: any) => {
						const next: Record<string, number> = {};
						snap.forEach((doc: any) => {
							const data = doc.data();
							Object.entries(data).forEach(([k, v]) => {
								if (typeof v === "number") next[k] = v;
							});
						});
						setChecklistStates(next);
					},
				);
			} catch {
				/* noop */
			}
		})();
		return () => unsub?.();
	}, [companyId, eventId]);

	const headerDate = event?.date ? parseISO(event.date) : null;
	const headerDateLabel = headerDate
		? format(headerDate, "EEEE · MMMM d")
		: "";

	const titleParts = (event?.title ?? "").trim().split(" ");
	const titleHead = titleParts.slice(0, -1).join(" ");
	const titleTail = titleParts[titleParts.length - 1] ?? "";

	const locationName = event?.locations
		? Object.keys(event.locations)[0]
		: undefined;

	const timeRange =
		event?.startTime && event?.endTime
			? `${event.startTime} – ${event.endTime}`
			: (event?.startTime ?? "Time TBD");

	const youInCrew = workers.find((w) => w.id === userId);

	const InfoRow = ({
		icon,
		label,
		sub,
		trailing,
	}: {
		icon: IconName;
		label: string;
		sub?: string;
		trailing?: React.ReactNode;
	}) => (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 14,
				paddingHorizontal: 16,
				paddingVertical: 14,
			}}
		>
			<View
				style={{
					width: 36,
					height: 36,
					borderRadius: 12,
					backgroundColor: Cream[100],
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Icon name={icon} size={18} color={Olive[700]} />
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Text variant="caption" weight="semibold">
					{label}
				</Text>
				{sub && (
					<Text
						variant="small"
						color="secondary"
						style={{ marginTop: 1 }}
					>
						{sub}
					</Text>
				)}
			</View>
			{trailing}
		</View>
	);

	const ChecklistItemRow = ({
		text,
		done,
	}: {
		text: string;
		done: boolean;
	}) => (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				paddingHorizontal: 12,
				paddingVertical: 11,
			}}
		>
			<View
				style={{
					width: 20,
					height: 20,
					borderRadius: 6,
					backgroundColor: done ? Olive[600] : "transparent",
					borderWidth: done ? 0 : 1.5,
					borderColor: theme.BorderStrong,
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{done && (
					<Icon
						name="check"
						size={12}
						color={Cream[50]}
						strokeWidth={2.4}
					/>
				)}
			</View>
			<Text
				variant="caption"
				style={{
					flex: 1,
					color: done ? theme.TertiaryText : theme.PrimaryText,
					textDecorationLine: done ? "line-through" : "none",
				}}
			>
				{text}
			</Text>
		</View>
	);

	const itemList: Array<{ id: string; text: string }> = (() => {
		// Pull checklist items off the event itself if present; fall back to empty.
		const checklists: any[] = event?.checklists ?? [];
		const items: Array<{ id: string; text: string }> = [];
		for (const c of checklists) {
			for (const it of c.items ?? []) {
				items.push({ id: it.id, text: it.text });
			}
		}
		return items;
	})();

	return (
		<View style={{ flex: 1, backgroundColor: theme.Background }}>
			<StatusBar barStyle="dark-content" />
			{/* Hero */}
			<View
				style={{
					height: HERO_HEIGHT,
					overflow: "hidden",
					position: "relative",
					backgroundColor: Cream[200],
				}}
			>
				<View
					style={{
						position: "absolute",
						inset: 0,
						backgroundColor: Olive[100],
					}}
				/>
				<View
					style={{
						position: "absolute",
						left: 16,
						bottom: 14,
						flexDirection: "row",
						gap: 6,
					}}
				>
					{event?.label && <Pill tone="terra">{event.label}</Pill>}
					<Pill tone="cream">
						{event?.title?.split(" ").slice(0, 2).join(" ") ??
							"Event"}
					</Pill>
				</View>
				{/* Back button */}
				<View
					style={{
						position: "absolute",
						top: 56,
						left: 14,
					}}
				>
					<TouchableOpacity
						onPress={() => navigation.goBack()}
						activeOpacity={0.85}
						style={{
							width: 38,
							height: 38,
							borderRadius: 19,
							backgroundColor: "rgba(255,254,250,0.92)",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="chevL" size={18} color={Ink[900]} />
					</TouchableOpacity>
				</View>
				<View
					style={{
						position: "absolute",
						top: 56,
						right: 14,
						flexDirection: "row",
						gap: 8,
					}}
				>
					<TouchableOpacity
						activeOpacity={0.85}
						style={{
							width: 38,
							height: 38,
							borderRadius: 19,
							backgroundColor: "rgba(255,254,250,0.92)",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="star" size={18} color={Ink[900]} />
					</TouchableOpacity>
					<TouchableOpacity
						activeOpacity={0.85}
						style={{
							width: 38,
							height: 38,
							borderRadius: 19,
							backgroundColor: "rgba(255,254,250,0.92)",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<Icon name="more" size={18} color={Ink[900]} />
					</TouchableOpacity>
				</View>
			</View>

			{/* Body */}
			<ScrollView
				style={{
					flex: 1,
					marginTop: -28,
					backgroundColor: theme.Background,
					borderTopLeftRadius: 28,
					borderTopRightRadius: 28,
				}}
				contentContainerStyle={{ paddingBottom: 100 }}
				showsVerticalScrollIndicator={false}
			>
				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 18,
						paddingBottom: 6,
					}}
				>
					<Text variant="eyebrow" color="warm">
						{headerDateLabel}
					</Text>
					<View
						style={{
							flexDirection: "row",
							flexWrap: "wrap",
							marginTop: 4,
						}}
					>
						<Text variant="display" style={{ lineHeight: 32 }}>
							{titleHead ? `${titleHead} ` : ""}
						</Text>
						<Text
							variant="display"
							color="accent"
							italic
							style={{ lineHeight: 32 }}
						>
							{titleTail}
						</Text>
					</View>
				</View>

				{/* Time + location + pack */}
				<View style={{ paddingHorizontal: 16 }}>
					<Card padding="none" style={{ overflow: "hidden" }}>
						<InfoRow
							icon="clock"
							label={timeRange}
							sub={
								event?.duration
									? `${event.duration} shift · Arrive 15 min early`
									: "Arrive 15 min early"
							}
						/>
						{locationName && (
							<>
								<Divider inset={56} soft />
								<InfoRow
									icon="pin"
									label={locationName}
									sub={
										event?.locations?.[locationName]
											? `Lat ${event.locations[locationName].latitude?.toFixed(3) ?? ""}, Lng ${event.locations[locationName].longitude?.toFixed(3) ?? ""}`
											: undefined
									}
								/>
							</>
						)}
						{event?.packages?.length > 0 && (
							<>
								<Divider inset={56} soft />
								<InfoRow
									icon="bag"
									label={`${event.packages.length} package${event.packages.length === 1 ? "" : "s"}`}
									sub="Tap to see pack & gear"
								/>
							</>
						)}
					</Card>
				</View>

				{/* Team */}
				{workers.length > 0 && (
					<>
						<SectionHead
							title="Team"
							trailing={`${workers.length} workers`}
						/>
						<View style={{ paddingHorizontal: 16 }}>
							<Card padding="none" style={{ overflow: "hidden" }}>
								{workers.map((w, i) => {
									const tone =
										w.status === "confirmed"
											? "olive"
											: w.status === "declined"
												? "rust"
												: w.status === "pending"
													? "amber"
													: "neutral";
									const tag =
										w.id === userId
											? "You"
											: w.status === "confirmed"
												? "Confirmed"
												: w.status === "declined"
													? "Declined"
													: "Pending";
									return (
										<View key={w.id}>
											<View
												style={{
													flexDirection: "row",
													alignItems: "center",
													gap: 12,
													paddingHorizontal: 14,
													paddingVertical: 12,
												}}
											>
												<Avatar
													name={w.name}
													size={36}
												/>
												<View
													style={{
														flex: 1,
														minWidth: 0,
													}}
												>
													<Text
														variant="caption"
														weight="semibold"
													>
														{w.name}
													</Text>
													<Text
														variant="small"
														color="secondary"
														style={{
															marginTop: 1,
														}}
													>
														{w.id === userId
															? "Worker"
															: "Worker"}
													</Text>
												</View>
												<Pill
													tone={
														w.id === userId
															? "olive"
															: (tone as any)
													}
												>
													{tag}
												</Pill>
											</View>
											{i < workers.length - 1 && (
												<Divider inset={62} soft />
											)}
										</View>
									);
								})}
							</Card>
						</View>
					</>
				)}

				{/* Checklist */}
				{itemList.length > 0 && (
					<>
						<SectionHead
							title="Checklist"
							trailing={`${itemList.filter((it) => checklistStates[it.id] === 1).length} / ${itemList.length} done`}
						/>
						<View style={{ paddingHorizontal: 16 }}>
							<Card padding="none">
								<View style={{ padding: 6 }}>
									{itemList.map((it, i) => (
										<View key={it.id}>
											<ChecklistItemRow
												text={it.text}
												done={
													checklistStates[it.id] === 1
												}
											/>
											{i < itemList.length - 1 && (
												<Divider soft inset={42} />
											)}
										</View>
									))}
								</View>
							</Card>
						</View>
					</>
				)}

				{/* Notes */}
				{event?.notes && (
					<>
						<SectionHead title="Notes" />
						<View
							style={{ paddingHorizontal: 16, paddingBottom: 24 }}
						>
							<Card tone="cream">
								<Text
									variant="caption"
									color="primary"
									style={{ lineHeight: 20 }}
								>
									{event.notes}
								</Text>
							</Card>
						</View>
					</>
				)}
			</ScrollView>
		</View>
	);
};

function SectionHead({
	title,
	trailing,
}: {
	title: string;
	trailing?: string;
}) {
	return (
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
			<Text variant="caption" weight="semibold">
				{title}
			</Text>
			{trailing && (
				<Text variant="mono" color="tertiary" style={{ fontSize: 12 }}>
					{trailing}
				</Text>
			)}
		</View>
	);
}

export default EventDetailsScreen;
