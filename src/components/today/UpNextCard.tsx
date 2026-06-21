import React from "react";
import { View } from "react-native";
import { format, parseISO } from "date-fns";
import { Cream } from "../../constants/colors";
import { FontFamily } from "../../constants/tokens";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { Pill, PillTone } from "../ui/Pill";
import { Avatar } from "../ui/Avatar";

interface UpNextCardProps {
	dayLabel: string; // e.g. "FRI"
	dayNumber: string; // e.g. "30"
	tone?: PillTone; // event type tone
	tag?: string; // event type label
	durationLabel?: string; // e.g. "8h shift"
	title: string;
	timeRange?: string;
	location?: string;
	workerNames?: string[];
	extraWorkers?: number;
	onPress?: () => void;
}

export const UpNextCard: React.FC<UpNextCardProps> = ({
	dayLabel,
	dayNumber,
	tone = "terra",
	tag,
	durationLabel,
	title,
	timeRange,
	location,
	workerNames = [],
	extraWorkers = 0,
	onPress,
}) => {
	return (
		<Card padding="none" onPress={onPress} style={{ overflow: "hidden" }}>
			<View
				style={{
					flexDirection: "row",
					gap: 14,
					padding: 16,
				}}
			>
				<View
					style={{
						width: 56,
						height: 64,
						borderRadius: 16,
						backgroundColor: Cream[100],
						alignItems: "center",
						justifyContent: "center",
						borderWidth: 0.5,
						borderColor: "rgba(229,218,193,0.7)",
					}}
				>
					<Text
						variant="eyebrow"
						color="warm"
						style={{ fontSize: 10.5 }}
					>
						{dayLabel}
					</Text>
					<Text
						style={{
							fontFamily: FontFamily.display,
							fontSize: 26,
							lineHeight: 28,
							marginTop: 2,
						}}
					>
						{dayNumber}
					</Text>
				</View>

				<View style={{ flex: 1, minWidth: 0 }}>
					<View
						style={{
							flexDirection: "row",
							gap: 6,
							alignItems: "center",
							marginBottom: 4,
						}}
					>
						{tag && <Pill tone={tone}>{tag}</Pill>}
						{durationLabel && (
							<Pill tone="neutral">{durationLabel}</Pill>
						)}
					</View>
					<Text variant="h3" style={{ lineHeight: 20 }}>
						{title}
					</Text>
					{(timeRange || location) && (
						<View
							style={{
								flexDirection: "row",
								gap: 6,
								alignItems: "center",
								marginTop: 4,
							}}
						>
							{timeRange && (
								<Text variant="mono" color="secondary">
									{timeRange}
								</Text>
							)}
							{timeRange && location && (
								<Text variant="caption" color="tertiary">
									·
								</Text>
							)}
							{location && (
								<Text variant="caption" color="secondary">
									{location}
								</Text>
							)}
						</View>
					)}
					{workerNames.length > 0 && (
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								marginTop: 10,
							}}
						>
							{workerNames.slice(0, 4).map((n, i) => (
								<View
									key={n}
									style={{ marginLeft: i ? -8 : 0 }}
								>
									<Avatar name={n} size={24} />
								</View>
							))}
							{extraWorkers > 0 && (
								<Text
									variant="small"
									color="secondary"
									style={{ marginLeft: 8 }}
								>
									+ {extraWorkers} more
								</Text>
							)}
						</View>
					)}
				</View>
			</View>
		</Card>
	);
};
