import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useUser } from "../../contexts/UserContext";
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

const UserPreferences = ({ navigation }) => {
	const styles = useThemedStyles(preferenceStyles);
	const { userId, isAdmin } = useUser();
	const { mode, scheme, selectMode } = useThemePreference();

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
