import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useCompany } from "../../../contexts/CompanyContext";
import {
	Card,
	Icon,
	Input,
	ListRow,
	Pressable,
	Screen,
	ScreenHeader,
	SegmentedControl,
	SkeletonList,
	Text,
	toast,
	Toggle,
} from "../../../components/ui";
import { IconName } from "../../../components/ui/Icon";
import { GeofenceEditor } from "../../../components/settings/GeofenceEditor";
import {
	CompanyPreferences as CompanyPrefs,
	ReminderSchedule,
} from "../../../types";
import { haptics, Theme, useThemedStyles } from "../../../theme";

/*
 * Company-wide configuration.
 *
 * The four feature toggles each repeated the same `trackColor`/`thumbColor`
 * literal verbatim; they are `Toggle` rows now, so the switch is styled once.
 *
 * Toggling a flag here adds or removes a whole tab for every member of the
 * company — preferences are a live subscription — so each row says what it
 * actually does rather than naming the setting.
 */

type FlagKey =
	| "allowUserEventEditing"
	| "enableTimeSheet"
	| "enableAvailability"
	| "canViewEventLabels";

const FLAGS: {
	key: FlagKey;
	title: string;
	subtitle: string;
	icon: IconName;
}[] = [
	{
		key: "enableTimeSheet",
		title: "Time tracking",
		subtitle: "Adds the Clock tab and payroll review",
		icon: "time-outline",
	},
	{
		key: "enableAvailability",
		title: "Availability",
		subtitle: "Adds the Availability tab and worker groups",
		icon: "people-outline",
	},
	{
		key: "allowUserEventEditing",
		title: "Workers can suggest edits",
		subtitle: "Lets non-managers submit changes to an event",
		icon: "create-outline",
	},
	{
		key: "canViewEventLabels",
		title: "Workers see event labels",
		subtitle: "Shows your colour coding on their calendar",
		icon: "pricetag-outline",
	},
];

/*
 * What the app tells a tracked worker, and what it lets them refuse.
 *
 * All three default ON. They are listed together and worded as what the worker
 * gets, not as what the company gains, because that is the decision actually
 * being made — and because the OS-level indicators do not go away whatever is
 * chosen here, which the footnote under these rows says plainly.
 */
type TransparencyKey =
	"showRecordingIndicator" | "workersSeeOwnRoutes" | "allowDeclining";

const TRANSPARENCY: {
	key: TransparencyKey;
	title: string;
	subtitle: string;
	icon: IconName;
}[] = [
	{
		key: "showRecordingIndicator",
		title: "Show workers when recording is on",
		subtitle: "A line on their clock screen while a shift is tracked",
		icon: "radio-outline",
	},
	{
		key: "workersSeeOwnRoutes",
		title: "Let workers see their own route",
		subtitle: "On their own timesheets. Managers always see every route",
		icon: "map-outline",
	},
	{
		key: "allowDeclining",
		title: "Let workers decline",
		subtitle: "Off makes tracking a condition of clocking in here",
		icon: "hand-left-outline",
	},
];

/*
 * One repeating reminder: whether to send it, and how long to leave between
 * reminders to the same worker.
 *
 * An INTERVAL, not a lead time before the event. The fields are held locally
 * and committed on blur — writing per keystroke would publish "2" on the way
 * to typing "24", and preferences are a live subscription, so every member's
 * app would see each intermediate value.
 */
function ReminderRows({
	title,
	subtitle,
	icon,
	schedule,
	onChange,
}: {
	title: string;
	subtitle: string;
	icon: IconName;
	schedule: ReminderSchedule | undefined;
	onChange: (next: ReminderSchedule) => void;
}) {
	const styles = useThemedStyles(companyPrefStyles);
	const current = schedule ?? { enabled: false, hours: 0, minutes: 0 };

	const [hours, setHours] = useState(String(current.hours ?? 0));
	const [minutes, setMinutes] = useState(String(current.minutes ?? 0));

	// Re-seed when the server value changes underneath — another admin, or
	// another device.
	useEffect(() => {
		setHours(String(current.hours ?? 0));
		setMinutes(String(current.minutes ?? 0));
	}, [current.hours, current.minutes]);

	const commit = () => {
		const h = Math.max(0, parseInt(hours, 10) || 0);
		const m = Math.min(59, Math.max(0, parseInt(minutes, 10) || 0));
		setHours(String(h));
		setMinutes(String(m));
		if (h === current.hours && m === current.minutes) return;
		onChange({ ...current, hours: h, minutes: m });
	};

	const zero = (current.hours ?? 0) === 0 && (current.minutes ?? 0) === 0;

	return (
		<>
			<ListRow
				multiline
				title={title}
				subtitle={subtitle}
				icon={icon}
				separator={current.enabled}
				accessory={
					<Toggle
						value={current.enabled}
						onValueChange={(enabled) =>
							onChange({ ...current, enabled })
						}
					/>
				}
			/>

			{current.enabled && (
				<View style={styles.intervalBlock}>
					<View style={styles.intervalRow}>
						<Input
							label="Every (hours)"
							value={hours}
							onChangeText={setHours}
							onBlur={commit}
							keyboardType="number-pad"
							placeholder="24"
							containerStyle={styles.flex}
						/>
						<Input
							label="Minutes"
							value={minutes}
							onChangeText={setMinutes}
							onBlur={commit}
							keyboardType="number-pad"
							placeholder="0"
							containerStyle={styles.flex}
						/>
					</View>

					{/* Zero would mean "every time the scheduler runs", so it
					    is treated as unconfigured — said here, not discovered. */}
					<Text
						variant="caption"
						color={zero ? "warning" : "textSecondary"}
					>
						{zero
							? "Set an interval — at zero, nothing is sent."
							: `Reminders repeat every ${current.hours}h ${current.minutes}m until answered.`}
					</Text>
				</View>
			)}
		</>
	);
}

const CompanyPreferences = ({ navigation }) => {
	const styles = useThemedStyles(companyPrefStyles);
	const { company, preferences, isLoading, updatePreferences } = useCompany();
	const [copied, setCopied] = useState(false);

	const inviteCode = company?.accessCode || "";

	const handleCopyInviteCode = async () => {
		await Clipboard.setStringAsync(inviteCode);
		haptics.success();
		setCopied(true);
		toast.success("Invite code copied");
		setTimeout(() => setCopied(false), 2000);
	};

	const setFlag = (key: FlagKey, value: boolean) =>
		updatePreferences({ ...preferences, [key]: value });

	const save = (patch: Partial<CompanyPrefs>) =>
		updatePreferences({ ...preferences, ...patch });

	/*
	 * Writes ONLY what changed, unlike `save` above.
	 *
	 * updatePreferences is documented as a field-level patch precisely so a
	 * stale device cannot revive superseded values, and spreading the whole
	 * live preferences object back defeats that. The older rows still do it;
	 * new ones should not, and the location block below does not.
	 */
	const patch = (next: Partial<CompanyPrefs>) => updatePreferences(next);

	/*
	 * Absent on companies that predate the setting, and absent means REQUIRED —
	 * it is what the app already did for everyone, so a missing field must not
	 * read as "switched off".
	 */
	const requireAck = preferences.requireAssignmentAcknowledgement !== false;

	const header = (
		<ScreenHeader
			title="Company preferences"
			subtitle={company?.name || undefined}
			onBack={() => navigation.goBack()}
		/>
	);

	if (isLoading) {
		return (
			<Screen header={header}>
				<SkeletonList rows={6} />
			</Screen>
		);
	}

	return (
		<Screen scroll padded header={header}>
			<Card title="Invite code" style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.hint}
				>
					Anyone with this code can join{" "}
					{company?.name || "the company"}.
				</Text>

				<Pressable
					onPress={handleCopyInviteCode}
					haptic={null}
					scaleOnPress={false}
					accessibilityLabel={`Copy invite code ${inviteCode}`}
					style={styles.codeChip}
				>
					<Text variant="heading" style={styles.code}>
						{inviteCode || "—"}
					</Text>
					<Icon
						name={copied ? "checkmark" : "copy-outline"}
						size="sm"
						color={copied ? "success" : "accent"}
					/>
				</Pressable>
			</Card>

			<Card title="Payroll" style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.hint}
				>
					Which day a work week starts on. Drives the Clock tab and
					payroll totals.
				</Text>

				<SegmentedControl<"sunday" | "monday">
					segments={[
						{ value: "sunday", label: "Sunday" },
						{ value: "monday", label: "Monday" },
					]}
					value={preferences.workWeekStarts}
					onChange={(value) =>
						updatePreferences({
							...preferences,
							workWeekStarts: value,
						})
					}
				/>
			</Card>

			<Card title="Features" flush style={styles.card}>
				{FLAGS.map((flag, index) => (
					<ListRow
						key={flag.key}
						multiline
						title={flag.title}
						subtitle={flag.subtitle}
						icon={flag.icon}
						separator={index < FLAGS.length - 1}
						accessory={
							<Toggle
								value={!!preferences[flag.key]}
								onValueChange={(value) =>
									setFlag(flag.key, value)
								}
							/>
						}
					/>
				))}
			</Card>

			{/*
			 * Notifications, gathered here rather than on the Availability
			 * screen where the reminder settings used to live. They are company
			 * configuration, and an admin looking for what the company sends
			 * looks in company preferences.
			 */}
			<Card title="Notifications" flush style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.flushHint}
				>
					Each reminder is one message per worker covering every event
					they owe that answer on — never one per event.
				</Text>

				{/*
				 * Only meaningful where the feature exists. Without the
				 * Availability tab there are no invitations to answer.
				 */}
				{preferences.enableAvailability && (
					<ReminderRows
						title="Chase unanswered availability"
						subtitle="Workers who have not replied to an invitation"
						icon="hand-left-outline"
						schedule={preferences.availabilityReminder}
						onChange={(availabilityReminder) =>
							save({ availabilityReminder })
						}
					/>
				)}

				<ListRow
					multiline
					title="Require shift confirmation"
					subtitle="Assigned workers must confirm they have seen it"
					icon="checkmark-circle-outline"
					separator={requireAck}
					accessory={
						<Toggle
							value={requireAck}
							onValueChange={(value) =>
								save({
									requireAssignmentAcknowledgement: value,
								})
							}
						/>
					}
				/>

				{requireAck && (
					<>
						<ReminderRows
							title="Chase unconfirmed shifts"
							subtitle="Workers scheduled but not yet confirmed"
							icon="alarm-outline"
							schedule={preferences.acknowledgementReminder}
							onChange={(acknowledgementReminder) =>
								save({ acknowledgementReminder })
							}
						/>
					</>
				)}
			</Card>

			{/*
			 * Location, and only where there is a clock to attach it to.
			 * Without time tracking there is no shift to record against and no
			 * reason to remind anyone to punch one.
			 */}
			{preferences.enableTimeSheet && (
				<Card title="Location" flush style={styles.card}>
					<Text
						variant="caption"
						color="textSecondary"
						style={styles.flushHint}
					>
						Both are off unless you turn them on. Workers are asked
						to agree before anything is recorded, and can decline.
					</Text>

					<ListRow
						multiline
						title="Track location while clocked in"
						subtitle="Records each worker's route for the whole shift"
						icon="navigate-outline"
						separator
						accessory={
							<Toggle
								value={preferences.locationTracking.enabled}
								onValueChange={(enabled) =>
									patch({
										locationTracking: {
											...preferences.locationTracking,
											enabled,
										},
									})
								}
							/>
						}
					/>

					{preferences.locationTracking.enabled && (
						<>
							<View style={styles.notice}>
								<Text variant="caption" color="warning">
									Every worker on the clock has their position
									recorded until they clock out, including
									when the app is closed. Tell your staff
									before you switch this on.
								</Text>
							</View>

							{TRANSPARENCY.map((row) => (
								<ListRow
									key={row.key}
									multiline
									title={row.title}
									subtitle={row.subtitle}
									icon={row.icon}
									separator
									accessory={
										<Toggle
											value={
												preferences.locationTracking[
													row.key
												]
											}
											onValueChange={(next) =>
												patch({
													locationTracking: {
														...preferences.locationTracking,
														[row.key]: next,
													},
												})
											}
										/>
									}
								/>
							))}

							{/*
							 * Said once, here, rather than on each row: these
							 * three change what the APP says, not what the
							 * phone does. Selling them internally as "workers
							 * won't know" would be wrong, so the screen refuses
							 * to imply it.
							 */}
							<View style={styles.notice}>
								<Text variant="caption" color="textTertiary">
									Whatever you choose here, iPhones show a
									blue location bar for the whole shift and
									Android shows a permanent notification.
									Workers are always told before their first
									tracked shift — that disclosure is required
									and cannot be switched off.
								</Text>
							</View>
						</>
					)}

					<ListRow
						multiline
						title="Clock in/out reminders"
						subtitle="Nudges workers to punch in and out around your address"
						icon="notifications-outline"
						separator={preferences.clockReminderGeofence.enabled}
						accessory={
							<Toggle
								value={
									preferences.clockReminderGeofence.enabled
								}
								onValueChange={(enabled) =>
									patch({
										clockReminderGeofence: {
											...preferences.clockReminderGeofence,
											enabled,
										},
									})
								}
							/>
						}
					/>

					{preferences.clockReminderGeofence.enabled && (
						<GeofenceEditor
							value={preferences.clockReminderGeofence}
							onChange={(clockReminderGeofence) =>
								patch({ clockReminderGeofence })
							}
						/>
					)}
				</Card>
			)}

			<View style={styles.footnote}>
				<Text variant="caption" color="textTertiary" align="center">
					Feature changes reach everyone in the company immediately.
				</Text>
			</View>
		</Screen>
	);
};

export default CompanyPreferences;

const companyPrefStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			marginTop: theme.spacing.lg,
		},
		hint: {
			marginBottom: theme.spacing.md,
		},
		flushHint: {
			paddingHorizontal: theme.spacing.lg,
			/*
			 * Matched to the md the Card's title row already leaves above it.
			 * At sm the intro copy sat closer to the first row than to the
			 * heading it belongs to.
			 */
			paddingBottom: theme.spacing.md,
		},
		/*
		 * Anything revealed BELOW a row by that row's own switch: the reminder
		 * interval fields, the geofence editor.
		 *
		 * paddingTop is the fix. Without it these blocks began immediately under
		 * the separator line, so the revealed content looked like it belonged to
		 * the row beneath rather than the one that opened it.
		 */
		intervalBlock: {
			paddingHorizontal: theme.spacing.lg,
			paddingTop: theme.spacing.md,
			paddingBottom: theme.spacing.md,
			gap: theme.spacing.sm,
		},
		/*
		 * The warning and footnote paragraphs inside a flush card.
		 *
		 * Its own style rather than borrowing intervalBlock: these are prose
		 * between two rows, and they need the same breathing room above and
		 * below or the sentence reads as a caption on whichever row it happens
		 * to be nearer.
		 */
		notice: {
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.md,
			gap: theme.spacing.sm,
		},
		intervalRow: {
			flexDirection: "row",
			gap: theme.spacing.md,
		},
		flex: {
			flex: 1,
		},
		codeChip: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: theme.spacing.md,
			paddingHorizontal: theme.spacing.lg,
			paddingVertical: theme.spacing.md,
			borderRadius: theme.radius.md,
			borderWidth: theme.hairlineWidth,
			borderColor: theme.colors.accentBorder,
			backgroundColor: theme.colors.accentSubtle,
		},
		code: {
			/* Monospace so an ambiguous character can be read back aloud. */
			fontFamily: "monospace",
			letterSpacing: 1,
		},
		footnote: {
			marginTop: theme.spacing.xl,
		},
	});
