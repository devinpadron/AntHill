import React, { useEffect, useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { Cream, Ink, Terra } from "../../constants/colors";
import { FontFamily } from "../../constants/tokens";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { StatusDot } from "../ui/StatusDot";
import { Icon } from "../ui/Icon";
import { AntGlyph } from "../ui/brand/AntGlyph";

interface ActiveClockCardProps {
	clockInAt: string;
	location?: string;
	eventTitle?: string;
	onPause?: () => void;
	onClockOut?: () => void;
}

function formatElapsed(ms: number): { hms: string; seconds: string } {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600)
		.toString()
		.padStart(2, "0");
	const m = Math.floor((total % 3600) / 60)
		.toString()
		.padStart(2, "0");
	const s = (total % 60).toString().padStart(2, "0");
	return { hms: `${h}:${m}`, seconds: s };
}

export const ActiveClockCard: React.FC<ActiveClockCardProps> = ({
	clockInAt,
	location,
	eventTitle,
	onPause,
	onClockOut,
}) => {
	const [now, setNow] = useState(Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const elapsed = now - new Date(clockInAt).getTime();
	const { hms, seconds } = formatElapsed(elapsed);

	const subtitle =
		[location, eventTitle].filter(Boolean).join(" · ") || "Active shift";

	return (
		<Card tone="ink" padding="none" style={{ overflow: "hidden" }}>
			<View
				style={{
					position: "absolute",
					right: -8,
					top: -12,
					opacity: 0.06,
					transform: [{ rotate: "18deg" }],
				}}
			>
				<AntGlyph size={140} color={Cream[50]} />
			</View>

			<View style={{ padding: 18, paddingBottom: 14 }}>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 8,
					}}
				>
					<StatusDot color="#9BCB3C" size={9} pulsing />
					<Text
						variant="eyebrow"
						style={{ color: "rgba(255,255,255,0.6)" }}
					>
						On the clock
					</Text>
				</View>

				<View
					style={{
						flexDirection: "row",
						alignItems: "baseline",
						marginTop: 8,
					}}
				>
					<Text
						style={{
							fontFamily: FontFamily.mono,
							fontSize: 56,
							color: Cream[50],
							letterSpacing: -1.5,
							lineHeight: 60,
						}}
					>
						{hms}
					</Text>
					<Text
						style={{
							fontFamily: FontFamily.mono,
							fontSize: 38,
							color: "rgba(255,255,255,0.4)",
							letterSpacing: -1,
							lineHeight: 60,
						}}
					>
						:{seconds}
					</Text>
				</View>

				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 6,
						marginTop: 4,
					}}
				>
					<Icon name="pin" size={14} color="rgba(255,255,255,0.7)" />
					<Text
						variant="caption"
						style={{ color: "rgba(255,255,255,0.7)" }}
					>
						{subtitle}
					</Text>
				</View>
			</View>

			<View
				style={{
					flexDirection: "row",
					gap: 8,
					paddingHorizontal: 10,
					paddingBottom: 10,
				}}
			>
				<TouchableOpacity
					onPress={onPause}
					activeOpacity={0.85}
					style={{
						flex: 1,
						height: 48,
						borderRadius: 16,
						backgroundColor: "rgba(255,255,255,0.08)",
						alignItems: "center",
						justifyContent: "center",
						flexDirection: "row",
						gap: 6,
					}}
				>
					<Icon
						name="pause"
						size={14}
						color={Cream[50]}
						fill={Cream[50]}
						strokeWidth={0}
					/>
					<Text
						style={{
							color: Cream[50],
							fontFamily: "Geist-SemiBold",
							fontSize: 14,
						}}
					>
						Pause
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={onClockOut}
					activeOpacity={0.9}
					style={{
						flex: 2,
						height: 48,
						borderRadius: 16,
						backgroundColor: Terra[500],
						alignItems: "center",
						justifyContent: "center",
						flexDirection: "row",
						gap: 8,
					}}
				>
					<Text
						style={{
							color: Cream[50],
							fontFamily: "Geist-Bold",
							fontSize: 14,
							letterSpacing: -0.1,
						}}
					>
						Clock out
					</Text>
					<Icon name="chev" size={16} color={Cream[50]} />
				</TouchableOpacity>
			</View>
		</Card>
	);
};
