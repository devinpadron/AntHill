import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useUser } from "../../contexts/UserContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
	setNotificationPreferences,
	subscribeMembership,
} from "../../services/membershipService";
import {
	Membership,
	NotificationChannel,
	NotificationPreferences,
	notificationPrefs,
} from "../../types";
import {
	subscribeUserSettings,
	updateUserSettings,
} from "../../services/userService";
import {
	Card,
	ListRow,
	Screen,
	ScreenHeader,
	SegmentedControl,
	SkeletonList,
	Text,
	toast,
	Toggle,
} from "../../components/ui";
import { IconName } from "../../components/ui/Icon";
import { Theme, ThemeMode, useThemePreference } from "../../theme";
import { useThemedStyles } from "../../theme";

/*
 * Per-user preferences.
 *
 * Saves on change rather than behind a "Save Preferences" button and a success
 * alert — every setting here is a single value with an obvious effect, so the
 * write can follow the tap.
 *
 * This is also where appearance lives. The theme layer resolves
 * light/dark/system app-wide; this is the only screen that sets it.
 */

const MAP_APPS: { label: string; value: string; icon: IconName }[] =
	Platform.OS === "ios"
		? [
				{ label: "Apple Maps", value: "apple", icon: "map-outline" },
				{
					label: "Google Maps",
					value: "google",
					icon: "navigate-outline",
				},
				{ label: "Waze", value: "waze", icon: "car-outline" },
			]
		: [
				{
					label: "Google Maps",
					value: "google",
					icon: "navigate-outline",
				},
				{ label: "Waze", value: "waze", icon: "car-outline" },
			];

const THEME_MODES: { value: ThemeMode; label: string }[] = [
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
	{ value: "system", label: "System" },
];

/*
 * One row per category the Cloud Functions actually send. Adding a row here
 * without a matching channel in the functions' CHANNEL_BY_TYPE map produces a
 * switch that silences nothing.
 */
const NOTIFICATION_ROWS: {
	channel: NotificationChannel;
	title: string;
	subtitle: string;
	icon: IconName;
	adminOnly?: boolean;
}[] = [
	{
		channel: "events",
		title: "My shifts",
		subtitle: "Assigned, removed, or details changed",
		icon: "calendar-outline",
	},
	{
		channel: "availability",
		title: "Availability requests",
		subtitle: "New events to reply to, and reminders",
		icon: "hand-left-outline",
	},
	{
		channel: "timesheets",
		title: "Timesheet decisions",
		subtitle: "When your hours are approved or rejected",
		icon: "time-outline",
	},
	{
		channel: "team",
		title: "Team activity",
		subtitle: "People joining or leaving, and availability replies",
		icon: "people-outline",
		adminOnly: true,
	},
];

const UserPreferences = ({ navigation }) => {
	const styles = useThemedStyles(preferenceStyles);
	const { userId, companyId, isAdmin } = useUser();
	const { company } = useCompany();
	const { mode, scheme, selectMode } = useThemePreference();

	/*
	 * Live from the membership, so a manager toggling someone's access or the
	 * same account changing this on another device is reflected here.
	 *
	 * `notificationPrefs` fills every gap with ON, which is what makes an
	 * account that predates this feature show all switches on rather than all
	 * off — the field is simply absent on every existing membership.
	 */
	const [membership, setMembership] = useState<Membership | null>(null);
	const notifications = notificationPrefs(membership);

	useEffect(() => {
		if (!companyId || !userId) return;
		return subscribeMembership(companyId, userId, setMembership);
	}, [companyId, userId]);

	const saveNotifications = async (
		patch: Partial<NotificationPreferences>,
	) => {
		const next = { ...notifications, ...patch };
		// Optimistic: the toggle must move under the thumb, not after a round
		// trip. The subscription overwrites this with the server's value.
		setMembership((prev) =>
			prev ? { ...prev, notifications: next } : prev,
		);
		try {
			await setNotificationPreferences(companyId, userId, next);
		} catch (error) {
			console.error("Error saving notification preferences:", error);
			toast.error("Could not save that", "Check your connection.");
		}
	};

	const rows = NOTIFICATION_ROWS.filter((row) => isAdmin || !row.adminOnly);

	const [loading, setLoading] = useState(true);
	const [prefMap, setPrefMap] = useState(
		Platform.OS === "ios" ? "apple" : "google",
	);
	const [prefFilter, setPrefFilter] = useState<"all" | "my">("all");

	/*
	 * Live, from userSettings/{userId}.
	 *
	 * This screen was still calling the v1 userService, which reads
	 * Users/{uid}/Preferences/settings — a path a v2-only account has nothing
	 * under, so it loaded blank and saved into a document nothing else reads.
	 */
	useEffect(() => {
		if (!userId) return;

		setLoading(true);
		return subscribeUserSettings(userId, (settings) => {
			if (settings) {
				if (settings.preferredMapApp)
					setPrefMap(settings.preferredMapApp);
				if (settings.defaultCalendarFilter)
					setPrefFilter(settings.defaultCalendarFilter);
			}
			setLoading(false);
		});
	}, [userId]);

	const save = async (patch: Record<string, unknown>) => {
		try {
			await updateUserSettings(userId, patch as any);
		} catch (error) {
			console.error("Error saving preferences:", error);
			toast.error("Could not save that", "Check your connection.");
		}
	};

	const header = (
		<ScreenHeader title="Preferences" onBack={() => navigation.goBack()} />
	);

	if (loading) {
		return (
			<Screen header={header}>
				<SkeletonList rows={5} />
			</Screen>
		);
	}

	return (
		<Screen scroll padded header={header}>
			<Card title="Appearance" style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.hint}
				>
					{mode === "system"
						? `Following your device, currently ${scheme}.`
						: `Always ${mode}, whatever your device is set to.`}
				</Text>

				<SegmentedControl<ThemeMode>
					segments={THEME_MODES}
					value={mode}
					onChange={selectMode}
				/>
			</Card>

			<Card title="Maps" flush style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.flushHint}
				>
					Which app opens when you tap an event's location.
				</Text>

				{MAP_APPS.map((option, index) => (
					<ListRow
						key={option.value}
						title={option.label}
						icon={option.icon}
						selected={prefMap === option.value}
						separator={index < MAP_APPS.length - 1}
						onPress={() => {
							setPrefMap(option.value);
							save({ preferredMapApp: option.value });
						}}
					/>
				))}
			</Card>

			{/*
			 * Push preferences.
			 *
			 * Per company, not per account: these live on the membership, so a
			 * user who works for two caterers can be reachable by one and quiet
			 * for the other. The subtitle says so rather than leaving someone to
			 * discover it.
			 */}
			<Card title="Notifications" flush style={styles.card}>
				<Text
					variant="caption"
					color="textSecondary"
					style={styles.flushHint}
				>
					{company?.name
						? `What ${company.name} can notify you about. Your other companies are set separately.`
						: "What this company can notify you about."}
				</Text>

				<ListRow
					title="Push notifications"
					subtitle={
						notifications.enabled
							? "On — choose what you hear about below"
							: "Off — nothing will be sent"
					}
					icon="notifications-outline"
					separator={notifications.enabled}
					accessory={
						<Toggle
							value={notifications.enabled}
							onValueChange={(value) =>
								saveNotifications({ enabled: value })
							}
						/>
					}
				/>

				{notifications.enabled &&
					rows.map((row, index) => (
						<ListRow
							key={row.channel}
							title={row.title}
							subtitle={row.subtitle}
							icon={row.icon}
							separator={index < rows.length - 1}
							accessory={
								<Toggle
									value={notifications[row.channel]}
									onValueChange={(value) =>
										saveNotifications({
											[row.channel]: value,
										})
									}
								/>
							}
						/>
					))}
			</Card>

			{/*
			 * Only managers have anything to choose here — a worker's calendar
			 * is always their own schedule.
			 */}
			{isAdmin && (
				<Card title="Calendar" flush style={styles.card}>
					<Text
						variant="caption"
						color="textSecondary"
						style={styles.flushHint}
					>
						Which events the calendar shows when you open it.
					</Text>

					<ListRow
						title="All events"
						subtitle="Everything on the company calendar"
						icon="albums-outline"
						selected={prefFilter === "all"}
						onPress={() => {
							setPrefFilter("all");
							save({ defaultCalendarFilter: "all" });
						}}
					/>
					<ListRow
						title="My events"
						subtitle="Only shifts you're scheduled on"
						icon="person-outline"
						selected={prefFilter === "my"}
						separator={false}
						onPress={() => {
							setPrefFilter("my");
							save({ defaultCalendarFilter: "my" });
						}}
					/>
				</Card>
			)}

			<View style={styles.footnote}>
				<Text variant="caption" color="textTertiary" align="center">
					Changes save as you make them.
				</Text>
			</View>
		</Screen>
	);
};

export default UserPreferences;

const preferenceStyles = (theme: Theme) =>
	StyleSheet.create({
		card: {
			marginTop: theme.spacing.lg,
		},
		hint: {
			marginBottom: theme.spacing.md,
		},
		flushHint: {
			paddingHorizontal: theme.spacing.lg,
			paddingBottom: theme.spacing.md,
		},
		footnote: {
			marginTop: theme.spacing.xl,
		},
	});
