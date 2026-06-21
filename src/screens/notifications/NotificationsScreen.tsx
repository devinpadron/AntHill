import React from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { useTheme } from "../../contexts/ThemeContext";
import { Text } from "../../components/ui/Text";
import { Icon, IconName } from "../../components/ui/Icon";
import { Olive, Terra, Amber, Rust, Info, Ink } from "../../constants/colors";
import { BorderRadius, FontFamily, Shadow } from "../../constants/tokens";

/**
 * In-app notifications inbox. The data layer isn't built yet (FCM is fire-and-forget
 * today), so this renders the design with sample groups. When the inbox model
 * lands, swap `MOCK_GROUPS` for a live subscription.
 */

type NotifTone = "olive" | "terra" | "amber" | "rust" | "info";

interface NotifItem {
	id: string;
	tone: NotifTone;
	icon: IconName;
	who: string;
	title: string;
	body: string;
	time: string;
	unread?: boolean;
}

interface NotifGroup {
	label: string;
	items: NotifItem[];
}

const MOCK_GROUPS: NotifGroup[] = [
	{
		label: "Today",
		items: [
			{
				id: "1",
				tone: "terra",
				icon: "cal",
				who: "Sasha (manager)",
				title: "Friday shift updated",
				body: "Hartman Wedding moved 30 min earlier — now 2:30 PM arrival.",
				time: "11:24 AM",
				unread: true,
			},
			{
				id: "2",
				tone: "olive",
				icon: "check",
				who: "Payroll",
				title: "Time entry approved",
				body: "Saturday · 8h 45m",
				time: "8:02 AM",
				unread: true,
			},
		],
	},
	{
		label: "Yesterday",
		items: [
			{
				id: "3",
				tone: "info",
				icon: "swap",
				who: "Theo R.",
				title: "Wants to swap Saturday",
				body: "Theo asked to take your 6 PM cleanup. Tap to review.",
				time: "5:14 PM",
			},
			{
				id: "4",
				tone: "amber",
				icon: "bell",
				who: "anthill",
				title: "Availability reminder",
				body: "Next month's schedule opens Friday — set your unavailable days.",
				time: "9:00 AM",
			},
		],
	},
	{
		label: "Earlier this week",
		items: [
			{
				id: "5",
				tone: "olive",
				icon: "bag",
				who: "Sasha (manager)",
				title: "New event assigned",
				body: "Riverside Brunch · Wednesday, 11 AM",
				time: "Mon",
			},
			{
				id: "6",
				tone: "rust",
				icon: "bell",
				who: "anthill",
				title: "Time entry needs a note",
				body: "Friday's clock-out was 22 min over scheduled — add a reason.",
				time: "Mon",
			},
		],
	},
];

const TONE_BG: Record<NotifTone, string> = {
	olive: Olive[100],
	terra: Terra[100],
	amber: Amber[100],
	rust: Rust[100],
	info: Info[100],
};

const TONE_FG: Record<NotifTone, string> = {
	olive: Olive[700],
	terra: Terra[700],
	amber: Amber[600],
	rust: Rust[600],
	info: Info[500],
};

const NotificationsScreen: React.FC = () => {
	const { theme } = useTheme();
	const navigation = useNavigation<any>();

	const totalUnread = MOCK_GROUPS.flatMap((g) => g.items).filter(
		(n) => n.unread,
	).length;
	const totalThisWeek = MOCK_GROUPS.flatMap((g) => g.items).length;

	return (
		<SafeAreaView
			edges={["top"]}
			style={{ flex: 1, backgroundColor: theme.Background }}
		>
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 32 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Header */}
				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 6,
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<TouchableOpacity
						onPress={() => navigation.goBack()}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 4,
						}}
						hitSlop={8}
					>
						<Icon name="chevL" size={18} color={Ink[700]} />
						<Text variant="body" weight="medium" color="primary">
							Today
						</Text>
					</TouchableOpacity>
					<TouchableOpacity hitSlop={8}>
						<Text variant="small" color="secondary" weight="medium">
							Mark all read
						</Text>
					</TouchableOpacity>
				</View>

				<View
					style={{
						paddingHorizontal: 20,
						paddingTop: 12,
						paddingBottom: 20,
					}}
				>
					<Text
						variant="display"
						style={{
							fontFamily: FontFamily.display,
							lineHeight: 38,
						}}
					>
						Inbox
					</Text>
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: 6,
							marginTop: 4,
						}}
					>
						<Text variant="mono" color="secondary">
							{totalUnread} new
						</Text>
						<Text variant="caption" color="secondary">
							· {totalThisWeek} total this week
						</Text>
					</View>
				</View>

				{MOCK_GROUPS.map((group) => (
					<View key={group.label}>
						<View
							style={{ paddingHorizontal: 22, paddingBottom: 8 }}
						>
							<Text variant="eyebrow" color="tertiary">
								{group.label}
							</Text>
						</View>
						<View
							style={{
								paddingHorizontal: 16,
								gap: 8,
								marginBottom: 18,
							}}
						>
							{group.items.map((item) => (
								<NotifCard
									key={item.id}
									item={item}
									surfaceColor={theme.Surface}
									borderColor={theme.BorderSoft}
								/>
							))}
						</View>
					</View>
				))}
			</ScrollView>
		</SafeAreaView>
	);
};

function NotifCard({
	item,
	surfaceColor,
	borderColor,
}: {
	item: NotifItem;
	surfaceColor: string;
	borderColor: string;
}) {
	return (
		<View
			style={{
				backgroundColor: surfaceColor,
				borderRadius: BorderRadius.lg,
				borderWidth: 0.5,
				borderColor,
				padding: 14,
				flexDirection: "row",
				gap: 12,
				position: "relative",
				...Shadow.sm,
			}}
		>
			<View
				style={{
					width: 38,
					height: 38,
					borderRadius: 12,
					backgroundColor: TONE_BG[item.tone],
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Icon
					name={item.icon}
					size={18}
					color={TONE_FG[item.tone]}
					strokeWidth={1.8}
				/>
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<View
					style={{
						flexDirection: "row",
						justifyContent: "space-between",
						alignItems: "baseline",
						gap: 8,
					}}
				>
					<Text
						variant="small"
						weight="semibold"
						style={{
							color: TONE_FG[item.tone],
							letterSpacing: 0.5,
							textTransform: "uppercase",
							fontSize: 11.5,
						}}
					>
						{item.who}
					</Text>
					<Text
						variant="mono"
						color="tertiary"
						style={{ fontSize: 11.5 }}
					>
						{item.time}
					</Text>
				</View>
				<Text
					variant="caption"
					weight="semibold"
					style={{ marginTop: 2 }}
				>
					{item.title}
				</Text>
				<Text
					variant="caption"
					color="secondary"
					style={{ marginTop: 3, lineHeight: 18 }}
				>
					{item.body}
				</Text>
			</View>
			{item.unread && (
				<View
					style={{
						position: "absolute",
						top: 16,
						right: 14,
						width: 8,
						height: 8,
						borderRadius: 4,
						backgroundColor: Terra[500],
					}}
				/>
			)}
		</View>
	);
}

export default NotificationsScreen;
