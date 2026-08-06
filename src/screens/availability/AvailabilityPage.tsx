import React, { useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useAvailability } from "../../hooks/useAvailability";
import {
	Badge,
	BadgeTone,
	Button,
	Card,
	EmptyState,
	Icon,
	Input,
	ListRow,
	Loading,
	Screen,
	ScreenHeader,
	SegmentedControl,
	Sheet,
	Text,
	toast,
	Toggle,
} from "../../components/ui";
import { IconName } from "../../components/ui/Icon";
import { Theme, useThemedStyles } from "../../theme";

/*
 * The worker's inbox for events they have been asked about.
 *
 * The three tabs were a hand-built indicator that measured the screen with
 * `Dimensions.get("window")` and sprang an absolutely-positioned bar across it
 * — which meant it was wrong on rotation and on any device it had not been
 * tuned against. They are a `SegmentedControl` now, laid out from measurement.
 *
 * Both full-screen `Modal`s became sheets: the reminder settings and the
 * admin-only worker roster.
 */

type Tab = "unconfirmed" | "confirmed" | "declined";

const AvailabilityPage = ({ navigation }) => {
	const styles = useThemedStyles(availabilityStyles);

	const {
		isAdmin,
		activeTab,
		setActiveTab,
		events,
		filteredEvents,
		loading,
		respondToEvent,
		reminder,
		saveReminderSettings: persistReminderSettings,
		workerBuckets: eventWorkerDetails,
		loadingWorkers: loadingWorkerDetails,
		loadWorkerBuckets,
		setWorkerResponse,
	} = useAvailability();

	// Sheet state stays here — it is presentation, not data.
	const reminderSheet = useRef<BottomSheet>(null);
	const adminSheet = useRef<BottomSheet>(null);
	const [reminderHours, setReminderHours] = useState("24");
	const [reminderMinutes, setReminderMinutes] = useState("0");
	const [remindersEnabled, setRemindersEnabled] = useState(true);
	const [selectedEventForAdmin, setSelectedEventForAdmin] = useState(null);

	/*
	 * Counts come off the unfiltered list, using the same predicates the hook
	 * filters with — so a tab's badge and its contents cannot disagree.
	 */
	const counts = useMemo(
		() => ({
			unconfirmed: events.filter(
				(e) => !e.confirmed && e.status !== "on_potential_event",
			).length,
			confirmed: events.filter((e) => e.confirmed).length,
			declined: events.filter(
				(e) => !e.confirmed && e.status === "on_potential_event",
			).length,
		}),
		[events],
	);

	const openReminderSettings = () => {
		setReminderHours(String(reminder?.hours ?? 24));
		setReminderMinutes(String(reminder?.minutes ?? 0));
		setRemindersEnabled(reminder?.enabled !== false);
		reminderSheet.current?.snapToIndex(0);
	};

	const saveReminderSettings = async () => {
		const saved = await persistReminderSettings({
			enabled: remindersEnabled,
			hours: reminderHours,
			minutes: reminderMinutes,
		});

		if (saved) {
			reminderSheet.current?.close();
			toast.success("Reminder settings saved");
		} else {
			toast.error("Could not save those settings");
		}
	};

	const openAdminSheet = (event) => {
		setSelectedEventForAdmin(event);
		adminSheet.current?.snapToIndex(0);
		loadWorkerBuckets(event.id);
	};

	const handleAdminStatusChange = (targetUserId, newStatus) => {
		if (!selectedEventForAdmin) return;
		return setWorkerResponse(
			selectedEventForAdmin,
			targetUserId,
			newStatus,
		);
	};

	const respond = async (
		item,
		status: "pending" | "confirmed" | "declined",
		message: string,
	) => {
		await respondToEvent(item, status);
		toast.success(message);
	};

	const renderEventCard = ({ item }) => {
		/*
		 * The status shown depends on which tab you are on: the confirmed and
		 * declined tabs state your answer, the unconfirmed tab states whether
		 * you are free.
		 */
		const status: { label: string; tone: BadgeTone; icon: IconName } =
			activeTab === "confirmed"
				? {
						label: "Confirmed",
						tone: "success",
						icon: "checkmark-circle",
					}
				: activeTab === "declined"
					? {
							label: "Declined",
							tone: "danger",
							icon: "close-circle",
						}
					: item.status === "available"
						? {
								label: "Available",
								tone: "success",
								icon: "checkmark-circle",
							}
						: item.status === "already_on_event"
							? {
									label: "Already booked",
									tone: "warning",
									icon: "calendar",
								}
							: {
									label: "New",
									tone: "neutral",
									icon: "help-circle",
								};

		const canRespond =
			activeTab === "unconfirmed" &&
			(item.status === "available" || item.status === "already_on_event");

		return (
			<Card
				style={styles.card}
				onPress={isAdmin ? () => openAdminSheet(item) : undefined}
			>
				<View style={styles.cardHeader}>
					<View style={styles.cardHeading}>
						<Text variant="heading" numberOfLines={2}>
							{item.title}
						</Text>
						<Text variant="body" color="textSecondary">
							{item.date}
						</Text>
					</View>

					<Badge
						label={status.label}
						tone={status.tone}
						icon={status.icon}
					/>
				</View>

				{!!item.location && (
					<View style={styles.metaRow}>
						<Icon
							name="location-outline"
							size="sm"
							color="textTertiary"
						/>
						<Text
							variant="caption"
							color="textSecondary"
							numberOfLines={1}
							style={styles.flex}
						>
							{item.location}
						</Text>
					</View>
				)}

				{/*
				 * Who this job went to. Only targeted jobs carry any badge, so
				 * the absence of one reads as "everyone" without needing its
				 * own label.
				 */}
				{(item.groupNames?.length > 0 ||
					item.personNames?.length > 0) && (
					<View style={styles.audienceRow}>
						{item.groupNames.map((name) => (
							<Badge
								key={`g-${name}`}
								label={name}
								icon="people"
								tone="accent"
							/>
						))}
						{/*
						 * Individually invited people, capped — a job sent to a
						 * dozen names should not push the date off the card.
						 */}
						{item.personNames.slice(0, 2).map((name) => (
							<Badge
								key={`p-${name}`}
								label={name}
								icon="person"
								tone="accent"
							/>
						))}
						{item.personNames.length > 2 && (
							<Badge label={`+${item.personNames.length - 2}`} />
						)}
					</View>
				)}

				{canRespond && (
					<View style={styles.actions}>
						<Button
							title="Decline"
							icon="close"
							variant="secondary"
							onPress={() =>
								respond(item, "declined", "Declined")
							}
							style={styles.flex}
						/>
						<Button
							title="I'm in"
							icon="checkmark"
							onPress={() =>
								respond(item, "confirmed", "You're confirmed")
							}
							haptic="press"
							style={styles.flex}
						/>
					</View>
				)}

				{/* Back to unanswered, from either the confirmed or declined tab. */}
				{activeTab !== "unconfirmed" && (
					<View style={styles.actions}>
						<Button
							title="Change my answer"
							icon="refresh"
							variant="secondary"
							onPress={() =>
								respond(item, "pending", "Moved back to new")
							}
							fullWidth
						/>
					</View>
				)}
			</Card>
		);
	};

	const emptyCopy: Record<Tab, { title: string; description: string }> = {
		unconfirmed: {
			title: "Nothing to answer",
			description:
				"When a manager publishes an event you can work, it shows up here.",
		},
		confirmed: {
			title: "No confirmed events",
			description: "Events you accept will be listed here.",
		},
		declined: {
			title: "Nothing declined",
			description: "Events you turn down will be listed here.",
		},
	};

	return (
		<Screen
			header={
				<ScreenHeader
					variant="large"
					title="Availability"
					subtitle="Events you've been asked about"
					actions={
						isAdmin
							? [
									{
										icon: "notifications-outline",
										label: "Reminder settings",
										onPress: openReminderSettings,
									},
								]
							: []
					}
				>
					<View style={styles.tabs}>
						<SegmentedControl<Tab>
							segments={[
								{
									value: "unconfirmed",
									label: "New",
									count: counts.unconfirmed,
								},
								{
									value: "confirmed",
									label: "Going",
									count: counts.confirmed,
								},
								{
									value: "declined",
									label: "Declined",
									count: counts.declined,
								},
							]}
							value={activeTab as Tab}
							onChange={setActiveTab}
						/>
					</View>
				</ScreenHeader>
			}
		>
			{loading ? (
				<Loading label="Loading events" />
			) : (
				<FlatList
					data={filteredEvents}
					renderItem={renderEventCard}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={
						<EmptyState
							icon="calendar-outline"
							title={emptyCopy[activeTab as Tab].title}
							description={
								emptyCopy[activeTab as Tab].description
							}
						/>
					}
				/>
			)}

			{/* Reminder settings — admin only. */}
			<Sheet
				ref={reminderSheet}
				snapPoints={["62%"]}
				title="Availability reminders"
				onClose={() => reminderSheet.current?.close()}
			>
				<BottomSheetScrollView
					contentContainerStyle={styles.sheetBody}
					keyboardShouldPersistTaps="handled"
				>
					<Text variant="body" color="textSecondary">
						How often workers are nudged to answer an event they
						have not responded to.
					</Text>

					<Card flush style={styles.sheetCard}>
						<ListRow
							title="Send reminders"
							subtitle="Automatic nudges until they answer"
							icon="notifications-outline"
							separator={false}
							accessory={
								<Toggle
									value={remindersEnabled}
									onValueChange={setRemindersEnabled}
								/>
							}
						/>
					</Card>

					{remindersEnabled ? (
						<>
							<View style={styles.intervalRow}>
								<Input
									label="Hours"
									value={reminderHours}
									onChangeText={setReminderHours}
									keyboardType="number-pad"
									placeholder="24"
									containerStyle={styles.flex}
								/>
								<Input
									label="Minutes"
									value={reminderMinutes}
									onChangeText={setReminderMinutes}
									keyboardType="number-pad"
									placeholder="0"
									containerStyle={styles.flex}
								/>
							</View>

							<Text variant="caption" color="textSecondary">
								Workers are reminded every{" "}
								{reminderHours || "24"}h{" "}
								{reminderMinutes || "0"}m until they confirm or
								decline. One reminder covers every event they
								owe an answer on, however many that is.
							</Text>
						</>
					) : (
						<Text variant="caption" color="textSecondary">
							Reminders are off. Workers will not be nudged to
							answer.
						</Text>
					)}

					<Button
						title="Save settings"
						icon="checkmark"
						onPress={saveReminderSettings}
						fullWidth
						haptic="press"
						style={styles.sheetAction}
					/>
				</BottomSheetScrollView>
			</Sheet>

			{/* Who has answered — admin only, opened by tapping an event. */}
			<Sheet
				ref={adminSheet}
				snapPoints={["70%", "92%"]}
				title="Who's answered"
				onClose={() => adminSheet.current?.close()}
			>
				{selectedEventForAdmin && (
					<View style={styles.adminHeader}>
						<Text variant="heading" numberOfLines={2}>
							{selectedEventForAdmin.title}
						</Text>
						<Text variant="caption" color="textSecondary">
							{selectedEventForAdmin.date}
							{selectedEventForAdmin.location
								? ` · ${selectedEventForAdmin.location}`
								: ""}
						</Text>
					</View>
				)}

				{loadingWorkerDetails ? (
					<Loading label="Loading responses" />
				) : (
					<BottomSheetScrollView
						contentContainerStyle={styles.sheetBody}
					>
						<WorkerBucket
							title="Confirmed"
							icon="checkmark-circle"
							tone="success"
							workers={eventWorkerDetails.confirmed}
							emptyText="Nobody has confirmed yet."
							actions={[
								{
									label: "Decline",
									icon: "close",
									status: "declined",
								},
							]}
							onAction={handleAdminStatusChange}
						/>

						<WorkerBucket
							title="Waiting"
							icon="help-circle"
							tone="warning"
							workers={eventWorkerDetails.unconfirmed}
							emptyText="Everyone has answered."
							actions={[
								{
									label: "Decline",
									icon: "close",
									status: "declined",
								},
								{
									label: "Confirm",
									icon: "checkmark",
									status: "confirmed",
								},
							]}
							onAction={handleAdminStatusChange}
						/>

						<WorkerBucket
							title="Declined"
							icon="close-circle"
							tone="danger"
							workers={eventWorkerDetails.declined}
							emptyText="Nobody has declined."
							actions={[
								{
									label: "Confirm",
									icon: "checkmark",
									status: "confirmed",
								},
							]}
							onAction={handleAdminStatusChange}
						/>

						<Button
							title="Open the event"
							icon="open-outline"
							variant="secondary"
							fullWidth
							onPress={() => {
								adminSheet.current?.close();
								navigation.navigate("EventDetails", {
									eventId: selectedEventForAdmin.id,
								});
							}}
							style={styles.sheetAction}
						/>
					</BottomSheetScrollView>
				)}
			</Sheet>
		</Screen>
	);
};

/** One response bucket in the admin sheet, with its per-worker overrides. */
const WorkerBucket = ({
	title,
	icon,
	tone,
	workers,
	emptyText,
	actions,
	onAction,
}: {
	title: string;
	icon: IconName;
	tone: BadgeTone;
	workers: any[];
	emptyText: string;
	actions: { label: string; icon: IconName; status: string }[];
	onAction: (userId: string, status: string) => void;
}) => {
	const styles = useThemedStyles(availabilityStyles);

	return (
		<View style={styles.bucket}>
			<View style={styles.bucketHeader}>
				<Badge
					label={`${title} · ${workers.length}`}
					tone={tone}
					icon={icon}
				/>
			</View>

			{workers.length === 0 ? (
				<Text variant="caption" color="textTertiary">
					{emptyText}
				</Text>
			) : (
				workers.map((user) => (
					<View key={user.id} style={styles.workerRow}>
						<Text variant="body" style={styles.flex}>
							{user.firstName} {user.lastName}
						</Text>
						{actions.map((action) => (
							<Button
								key={action.status}
								title={action.label}
								icon={action.icon}
								variant="secondary"
								size="small"
								onPress={() => onAction(user.id, action.status)}
							/>
						))}
					</View>
				))
			)}
		</View>
	);
};

export default AvailabilityPage;

const availabilityStyles = (theme: Theme) =>
	StyleSheet.create({
		flex: {
			flex: 1,
		},
		tabs: {
			paddingHorizontal: theme.spacing.lg,
			paddingBottom: theme.spacing.md,
		},
		list: {
			flexGrow: 1,
			padding: theme.spacing.lg,
			paddingBottom: theme.spacing["3xl"],
		},
		card: {
			marginBottom: theme.spacing.md,
		},
		cardHeader: {
			flexDirection: "row",
			alignItems: "flex-start",
			gap: theme.spacing.md,
		},
		cardHeading: {
			flex: 1,
		},
		metaRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.xs + 2,
			marginTop: theme.spacing.sm,
		},
		audienceRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: theme.spacing.xs,
			marginTop: theme.spacing.md,
		},
		actions: {
			flexDirection: "row",
			gap: theme.spacing.sm,
			marginTop: theme.spacing.lg,
		},
		sheetBody: {
			padding: theme.spacing.lg,
			paddingBottom: theme.spacing["2xl"],
			gap: theme.spacing.md,
		},
		sheetCard: {
			marginVertical: theme.spacing.xs,
		},
		intervalRow: {
			flexDirection: "row",
			gap: theme.spacing.md,
		},
		sheetAction: {
			marginTop: theme.spacing.md,
		},
		adminHeader: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.md,
			paddingBottom: theme.spacing.sm,
			borderBottomWidth: theme.hairlineWidth,
			borderBottomColor: theme.colors.border,
		},
		bucket: {
			gap: theme.spacing.sm,
		},
		bucketHeader: {
			flexDirection: "row",
			alignItems: "center",
		},
		workerRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: theme.spacing.sm,
			paddingVertical: theme.spacing.xs,
		},
	});
