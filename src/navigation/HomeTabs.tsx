import React from "react";
import { Platform } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CalendarStack from "./CalendarStack";
import SettingStack from "./SettingStack";
import ClockStack from "./ClockStack";
import AvailabilityStack from "./AvailabilityStack";
import { useCompany } from "../contexts/CompanyContext";
import { Icon, IconName } from "../components/ui";
import { useCompanySwitcher } from "../components/company/CompanySwitcher";
import { useEventPrompts } from "../hooks/useEventPrompts";
import { haptics, useTheme } from "../theme";

/*
 * The bottom tabs.
 *
 * Availability and Clock are feature-flagged off company preferences, so a
 * tab's very existence depends on company config — same as v1.
 *
 * Preferences are a LIVE subscription in v2, so toggling a feature flag now
 * adds or removes a tab without an app relaunch. Under v1 it did not.
 *
 * Labels stay hidden. Four tabs with unambiguous glyphs read cleaner without
 * them, and it is the same icon-led logic the rest of the redesign follows.
 */

const Tab = createBottomTabNavigator();

const icon =
	(active: IconName, inactive: IconName) =>
	({ focused, color }: { focused: boolean; color: string }) => (
		<Icon name={focused ? active : inactive} size="md" color={color} />
	);

/*
 * A selection tick when the tab actually changes.
 *
 * `tabPress` fires on every press including the current tab, which would buzz
 * on a no-op; the target's key against the focused route is what distinguishes
 * them.
 */
const tabListeners = ({ navigation, route }: any) => ({
	tabPress: () => {
		const focused =
			navigation.getState().routes[navigation.getState().index];
		if (focused?.key !== route.key) haptics.selection();
	},
});

const HomeTabs = () => {
	const { preferences } = useCompany();
	const switcher = useCompanySwitcher();
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const { unconfirmedCount, awaitingReply } = useEventPrompts();

	/*
	 * ONE badge style for every tab.
	 *
	 * These were briefly different colours — danger on Calendar, accent on
	 * Availability — on the reasoning that a shift already promised on your
	 * behalf is more serious than an invitation you have not answered. True,
	 * but it does not survive contact with a tab bar: two badges of different
	 * colours side by side read as two different KINDS of thing, and a user
	 * has to learn a colour code to find out they both mean "open this".
	 *
	 * Red, because that is what an unread count is everywhere else on a phone.
	 * Defined once so the next edit to one cannot desync the other.
	 */
	const badgeStyle = {
		backgroundColor: theme.colors.danger,
		color: theme.colors.textInverse,
		fontSize: 11,
	};

	return (
		<Tab.Navigator
			screenOptions={{
				headerShown: false,
				tabBarShowLabel: false,
				tabBarActiveTintColor: theme.colors.accent,
				tabBarInactiveTintColor: theme.colors.textTertiary,
				tabBarStyle: {
					backgroundColor: theme.colors.surface,
					borderTopWidth: theme.hairlineWidth,
					borderTopColor: theme.colors.border,
					/*
					 * Height is set explicitly because the default leaves the
					 * glyphs sitting low against the home indicator once the
					 * labels are hidden.
					 */
					height: insets.bottom + (Platform.OS === "ios" ? 52 : 60),
					paddingTop: 8,
					paddingBottom: insets.bottom || 8,
					elevation: 0,
				},
			}}
		>
			<Tab.Screen
				name="Calendar"
				component={CalendarStack}
				listeners={tabListeners}
				options={{
					tabBarAccessibilityLabel: "Calendar",
					tabBarIcon: icon("calendar", "calendar-outline"),
					/*
					 * Shifts this worker has been assigned but never confirmed
					 * seeing. A badge rather than a notification because it is
					 * a standing state, not an event — it should still be there
					 * tomorrow if they ignore it today.
					 *
					 * Undefined (not 0) when there are none: react-navigation
					 * renders a dot for 0.
					 */
					tabBarBadge: unconfirmedCount || undefined,
					tabBarBadgeStyle: badgeStyle,
				}}
			/>
			{preferences.enableAvailability && (
				<Tab.Screen
					name="Availability"
					component={AvailabilityStack}
					listeners={tabListeners}
					options={{
						tabBarAccessibilityLabel: "Availability",
						tabBarIcon: icon("people", "people-outline"),
						/* Invitations still unanswered. */
						tabBarBadge: awaitingReply || undefined,
						tabBarBadgeStyle: badgeStyle,
					}}
				/>
			)}
			{preferences.enableTimeSheet && (
				<Tab.Screen
					name="Clock"
					component={ClockStack}
					listeners={tabListeners}
					options={{
						tabBarAccessibilityLabel: "Clock",
						tabBarIcon: icon("time", "time-outline"),
					}}
				/>
			)}
			<Tab.Screen
				name="Settings"
				component={SettingStack}
				listeners={(props) => ({
					...tabListeners(props),
					/*
					 * Hold Settings to jump straight to the company switcher.
					 * Only bound when the user actually has somewhere to
					 * switch to, so a single-company user never gets a
					 * mystery gesture.
					 */
					tabLongPress: () => {
						if (switcher.available) switcher.open();
					},
				})}
				options={{
					tabBarAccessibilityLabel: "Settings",
					tabBarIcon: icon("settings", "settings-outline"),
				}}
			/>
		</Tab.Navigator>
	);
};

export default HomeTabs;
