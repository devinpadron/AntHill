import React from "react";
import { View } from "react-native";
import { Cream, Olive } from "../../constants/colors";
import { FontFamily } from "../../constants/tokens";
import { Card } from "../ui/Card";
import { Text } from "../ui/Text";
import { StatusDot } from "../ui/StatusDot";
import { useTheme } from "../../contexts/ThemeContext";

export interface WeekChartDay {
	label: string; // "M", "T", ...
	workedHours: number;
	plannedHours?: number;
	active?: boolean;
}

interface WeekChartProps {
	days: WeekChartDay[];
	overtimeHours?: number;
}

export const WeekChart: React.FC<WeekChartProps> = ({
	days,
	overtimeHours = 0,
}) => {
	const { theme } = useTheme();
	const maxBar = Math.max(
		9,
		...days.map((d) => Math.max(d.workedHours, d.plannedHours ?? 0)),
	);
	const CHART_HEIGHT = 110;

	return (
		<Card padding="md">
			<View
				style={{
					flexDirection: "row",
					height: CHART_HEIGHT,
					alignItems: "flex-end",
					justifyContent: "space-between",
					gap: 8,
				}}
			>
				{days.map((d, i) => {
					const totalForBar = Math.max(
						d.workedHours,
						d.plannedHours ?? 0,
					);
					const barHeight = Math.max(
						8,
						(totalForBar / maxBar) * CHART_HEIGHT,
					);
					const workedFraction =
						totalForBar > 0 ? d.workedHours / totalForBar : 0;
					return (
						<View
							key={`${d.label}-${i}`}
							style={{
								flex: 1,
								alignItems: "center",
								justifyContent: "flex-end",
								height: "100%",
							}}
						>
							<View
								style={{
									width: "100%",
									height: barHeight,
									borderRadius: 8,
									backgroundColor: Cream[200],
									overflow: "hidden",
									position: "relative",
								}}
							>
								{d.workedHours > 0 && (
									<View
										style={{
											position: "absolute",
											left: 0,
											right: 0,
											bottom: 0,
											height: `${workedFraction * 100}%`,
											backgroundColor: d.active
												? Olive[600]
												: Olive[500],
											borderRadius: 8,
										}}
									/>
								)}
								{d.active && (
									<View
										style={{
											position: "absolute",
											top: 4,
											left: 0,
											right: 0,
											alignItems: "center",
										}}
									>
										<StatusDot
											color={Cream[50]}
											size={6}
											pulsing
										/>
									</View>
								)}
							</View>
						</View>
					);
				})}
			</View>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					marginTop: 8,
				}}
			>
				{days.map((d, i) => (
					<View
						key={`label-${d.label}-${i}`}
						style={{ flex: 1, alignItems: "center" }}
					>
						<Text
							variant="small"
							style={{
								color: d.active
									? theme.AccentStrong
									: theme.TertiaryText,
								fontWeight: "600",
								letterSpacing: 0.6,
								fontSize: 10.5,
							}}
						>
							{d.label}
						</Text>
					</View>
				))}
			</View>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 14,
					marginTop: 12,
					paddingTop: 12,
					borderTopWidth: 0.5,
					borderTopColor: theme.BorderSoft,
				}}
			>
				<Legend swatch={Olive[500]} label="Worked" />
				<Legend swatch={Cream[200]} label="Scheduled" />
				<View style={{ flex: 1 }} />
				{overtimeHours > 0 && (
					<Text
						style={{
							fontFamily: FontFamily.mono,
							fontSize: 11.5,
							color: theme.TertiaryText,
						}}
					>
						+ {overtimeHours.toFixed(1)} OT
					</Text>
				)}
			</View>
		</Card>
	);
};

function Legend({ swatch, label }: { swatch: string; label: string }) {
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 6,
			}}
		>
			<View
				style={{
					width: 10,
					height: 10,
					borderRadius: 3,
					backgroundColor: swatch,
				}}
			/>
			<Text variant="small" color="secondary" style={{ fontSize: 11.5 }}>
				{label}
			</Text>
		</View>
	);
}
