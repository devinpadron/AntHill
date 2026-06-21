import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Olive } from "../../constants/colors";
import { BorderRadius, Shadow } from "../../constants/tokens";
import { useTheme } from "../../contexts/ThemeContext";
import { Text } from "../ui/Text";
import { Pill, PillTone } from "../ui/Pill";
import { Icon } from "../ui/Icon";
import { StatusDot } from "../ui/StatusDot";

interface EventRowProps {
	time?: string;
	durationLabel?: string;
	title: string;
	location?: string;
	tone?: PillTone; // accent tone
	tag?: string;
	current?: boolean; // highlights "Now"
	muted?: boolean;
	onPress?: () => void;
}

const TONE_BAR_COLOR: Record<PillTone, string> = {
	terra: "#C26543",
	amber: "#C89A2C",
	olive: "#5C7027",
	rust: "#A8442B",
	info: "#3F7184",
	cream: "#D8C9AF",
	ink: "#1D1D27",
	neutral: "#B0A892",
};

export const EventRow: React.FC<EventRowProps> = ({
	time,
	durationLabel,
	title,
	location,
	tone = "olive",
	tag,
	current = false,
	muted = false,
	onPress,
}) => {
	const { theme } = useTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.85}
			style={{
				backgroundColor: theme.Surface,
				borderRadius: BorderRadius.lg,
				borderWidth: current ? 1.5 : 0.5,
				borderColor: current ? Olive[600] : theme.BorderSoft,
				padding: 14,
				flexDirection: "row",
				gap: 14,
				opacity: muted ? 0.78 : 1,
				...(current ? Shadow.md : Shadow.sm),
			}}
		>
			<View
				style={{
					width: 3,
					alignSelf: "stretch",
					borderRadius: 2,
					backgroundColor: TONE_BAR_COLOR[tone],
				}}
			/>
			<View style={{ flex: 1, minWidth: 0 }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
						marginBottom: 4,
					}}
				>
					{tag && <Pill tone={tone}>{tag}</Pill>}
					{current && (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 4,
							}}
						>
							<StatusDot color={Olive[500]} size={6} pulsing />
							<Text
								variant="small"
								color="accent"
								weight="semibold"
								style={{ fontSize: 11 }}
							>
								Now
							</Text>
						</View>
					)}
				</View>
				<Text variant="h3" style={{ fontSize: 16, lineHeight: 20 }}>
					{title}
				</Text>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
						marginTop: 4,
					}}
				>
					{time && (
						<Text
							variant="mono"
							color="secondary"
							style={{ fontSize: 12.5 }}
						>
							{time}
						</Text>
					)}
					{durationLabel && (
						<>
							<Text variant="small" color="tertiary">
								·
							</Text>
							<Text variant="caption" color="secondary">
								{durationLabel}
							</Text>
						</>
					)}
					{location && (
						<>
							<Text variant="small" color="tertiary">
								·
							</Text>
							<Text variant="caption" color="secondary">
								{location}
							</Text>
						</>
					)}
				</View>
			</View>
			<Icon
				name="chev"
				size={16}
				color={theme.TertiaryText}
				strokeWidth={1.6}
			/>
		</TouchableOpacity>
	);
};
