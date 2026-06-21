import React from "react";
import { TouchableOpacity, View } from "react-native";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { FontFamily } from "../../constants/tokens";
import { Text } from "../ui/Text";
import { Pill, PillTone } from "../ui/Pill";
import { useTheme } from "../../contexts/ThemeContext";

interface EntryRowProps {
	clockInAt: string;
	clockOutAt?: string;
	durationSeconds?: number;
	status: string;
	overtime?: boolean;
	onPress?: () => void;
}

function statusMeta(status: string): { tone: PillTone; label: string } {
	switch (status) {
		case "approved":
			return { tone: "olive", label: "Approved" };
		case "pending_approval":
			return { tone: "amber", label: "Pending" };
		case "rejected":
			return { tone: "rust", label: "Denied" };
		case "active":
		case "paused":
			return { tone: "info", label: "In progress" };
		case "completed":
			return { tone: "amber", label: "Pending" };
		default:
			return { tone: "neutral", label: status };
	}
}

function formatHours(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return `${h}:${m.toString().padStart(2, "0")}`;
}

function dayLabel(d: Date): string {
	if (isToday(d)) return "Today";
	if (isYesterday(d)) return "Yesterday";
	return format(d, "EEEE");
}

export const EntryRow: React.FC<EntryRowProps> = ({
	clockInAt,
	clockOutAt,
	durationSeconds,
	status,
	overtime,
	onPress,
}) => {
	const { theme } = useTheme();
	const inDate = parseISO(clockInAt);
	const outDate = clockOutAt ? parseISO(clockOutAt) : null;
	const meta = statusMeta(status);
	const isLive = status === "active" || status === "paused";

	const timeRange = outDate
		? `${format(inDate, "h:mm a")} – ${format(outDate, "h:mm a")}`
		: `${format(inDate, "h:mm a")} – now`;

	const hours =
		typeof durationSeconds === "number"
			? formatHours(durationSeconds)
			: outDate
				? formatHours(
						Math.floor(
							(outDate.getTime() - inDate.getTime()) / 1000,
						),
					)
				: formatHours(
						Math.floor((Date.now() - inDate.getTime()) / 1000),
					);

	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingHorizontal: 16,
				paddingVertical: 14,
				gap: 14,
			}}
		>
			<View style={{ minWidth: 60 }}>
				<Text variant="caption" weight="semibold">
					{dayLabel(inDate)}
				</Text>
				<Text variant="small" color="tertiary" style={{ marginTop: 1 }}>
					{format(inDate, "MMM d")}
				</Text>
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<Text
					style={{
						fontFamily: FontFamily.mono,
						fontSize: 14,
						color: theme.SecondaryText,
					}}
				>
					{timeRange}
				</Text>
				<View
					style={{
						flexDirection: "row",
						gap: 6,
						marginTop: 4,
						alignItems: "center",
					}}
				>
					<Pill tone={meta.tone}>{meta.label}</Pill>
					{overtime && <Pill tone="terra">+ OT</Pill>}
				</View>
			</View>
			<View style={{ alignItems: "flex-end" }}>
				<Text
					style={{
						fontFamily: FontFamily.mono,
						fontSize: 18,
						color: theme.PrimaryText,
						letterSpacing: -0.2,
					}}
				>
					{hours}
				</Text>
				<Text
					variant="small"
					color="tertiary"
					style={{
						fontSize: 10.5,
						letterSpacing: 1,
						fontWeight: "600",
						textTransform: "uppercase",
					}}
				>
					hours
				</Text>
			</View>
		</TouchableOpacity>
	);
};
