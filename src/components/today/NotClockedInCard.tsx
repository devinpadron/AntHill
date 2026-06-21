import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Cream, Olive } from "../../constants/colors";
import { FontFamily } from "../../constants/tokens";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";

interface NotClockedInCardProps {
	nextShiftLabel?: string; // e.g. "Shift starts in 1h 12m"
	nextShiftAccent?: string; // italic accent string, e.g. "1h 12m"
	subtitle?: string; // e.g. "Hartman Rehearsal · 4:00 PM at Rosewood Estate"
	canClockIn?: boolean;
	onClockIn?: () => void;
}

export const NotClockedInCard: React.FC<NotClockedInCardProps> = ({
	nextShiftLabel = "Nothing scheduled",
	nextShiftAccent,
	subtitle,
	canClockIn = true,
	onClockIn,
}) => {
	return (
		<Card tone="paper" padding="none" style={{ overflow: "hidden" }}>
			<View style={{ padding: 20, paddingBottom: 8 }}>
				<Text variant="eyebrow" color="tertiary">
					Not clocked in
				</Text>
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						alignItems: "baseline",
						marginTop: 6,
					}}
				>
					<Text variant="h1" style={{ lineHeight: 28 }}>
						{nextShiftLabel}
					</Text>
					{nextShiftAccent && (
						<Text
							variant="h1"
							color="accent"
							italic
							style={{ lineHeight: 28, marginLeft: 6 }}
						>
							{nextShiftAccent}
						</Text>
					)}
				</View>
				{subtitle && (
					<Text
						variant="caption"
						color="secondary"
						style={{ marginTop: 6 }}
					>
						{subtitle}
					</Text>
				)}
			</View>
			{canClockIn && (
				<TouchableOpacity
					onPress={onClockIn}
					activeOpacity={0.9}
					style={{
						margin: 10,
						marginTop: 14,
						height: 56,
						borderRadius: 18,
						backgroundColor: Olive[600],
						alignItems: "center",
						justifyContent: "center",
						flexDirection: "row",
						gap: 10,
						shadowColor: Olive[600],
						shadowOffset: { width: 0, height: 6 },
						shadowOpacity: 0.3,
						shadowRadius: 18,
						elevation: 6,
					}}
				>
					<View
						style={{
							width: 10,
							height: 10,
							borderRadius: 5,
							backgroundColor: Cream[50],
						}}
					/>
					<Text
						style={{
							color: Cream[50],
							fontFamily: FontFamily.ui,
							fontWeight: "700",
							fontSize: 16,
							letterSpacing: -0.1,
						}}
					>
						Clock in
					</Text>
				</TouchableOpacity>
			)}
		</Card>
	);
};
