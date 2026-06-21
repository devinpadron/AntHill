import React from "react";
import { View, TouchableOpacity } from "react-native";
import { format, getDay, getDaysInMonth, isSameDay, parseISO } from "date-fns";
import { Cream, Ink, Olive, Terra, Amber } from "../../constants/colors";
import { FontFamily } from "../../constants/tokens";
import { Text } from "../ui/Text";

/**
 * Month grid for the redesigned Calendar screen.
 *  - 7-column grid with `S M T W T F S` weekday header
 *  - Today highlighted as a dark ink pill with the day number in mono
 *  - Up to 3 colored event dots per cell
 */

interface MonthGridProps {
	month: Date;
	today: Date;
	selectedDate: Date;
	eventsByDate: Record<string, { color: string }[]>; // ISO yyyy-MM-dd → dots
	onSelectDate: (d: Date) => void;
}

const FALLBACK_DOT_COLORS = [Terra[500], Olive[600], Amber[500]];

export function colorForLabel(label?: string | null): string {
	if (!label) return FALLBACK_DOT_COLORS[0];
	// hash label → one of the 3 dot colors so dots feel consistent without a labels lookup
	let h = 0;
	for (let i = 0; i < label.length; i++)
		h = (h * 31 + label.charCodeAt(i)) >>> 0;
	return FALLBACK_DOT_COLORS[h % FALLBACK_DOT_COLORS.length];
}

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export const MonthGrid: React.FC<MonthGridProps> = ({
	month,
	today,
	selectedDate,
	eventsByDate,
	onSelectDate,
}) => {
	const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
	const startOffset = getDay(firstOfMonth);
	const days = getDaysInMonth(month);

	const cells: (Date | null)[] = [];
	for (let i = 0; i < startOffset; i++) cells.push(null);
	for (let d = 1; d <= days; d++) {
		cells.push(new Date(month.getFullYear(), month.getMonth(), d));
	}
	while (cells.length % 7 !== 0) cells.push(null);

	return (
		<View style={{ paddingHorizontal: 14 }}>
			<View
				style={{
					flexDirection: "row",
					marginBottom: 6,
				}}
			>
				{WEEKDAY_LABELS.map((d, i) => (
					<View
						key={`${d}-${i}`}
						style={{
							flex: 1,
							alignItems: "center",
						}}
					>
						<Text
							variant="small"
							color="tertiary"
							weight="semibold"
							style={{ fontSize: 11, letterSpacing: 1.1 }}
						>
							{d}
						</Text>
					</View>
				))}
			</View>
			<View
				style={{
					flexDirection: "row",
					flexWrap: "wrap",
				}}
			>
				{cells.map((cell, idx) => {
					if (!cell) {
						return (
							<View
								key={`empty-${idx}`}
								style={{
									flexBasis: "14.2857%",
									aspectRatio: 1 / 1.05,
								}}
							/>
						);
					}
					const isToday = isSameDay(cell, today);
					const isSelected = isSameDay(cell, selectedDate);
					const iso = format(cell, "yyyy-MM-dd");
					const dots = eventsByDate[iso]?.slice(0, 3) ?? [];

					return (
						<TouchableOpacity
							key={iso}
							onPress={() => onSelectDate(cell)}
							activeOpacity={0.7}
							style={{
								flexBasis: "14.2857%",
								aspectRatio: 1 / 1.05,
								alignItems: "center",
								paddingTop: 6,
								paddingBottom: 4,
								borderRadius: 12,
								backgroundColor: isToday
									? Ink[900]
									: isSelected
										? Cream[200]
										: "transparent",
							}}
						>
							<Text
								style={{
									fontFamily: isToday
										? FontFamily.mono
										: FontFamily.display,
									fontSize: isToday ? 15 : 18,
									color: isToday ? Cream[50] : Ink[900],
								}}
							>
								{cell.getDate()}
							</Text>
							{dots.length > 0 && (
								<View
									style={{
										flexDirection: "row",
										gap: 2,
										marginTop: 6,
									}}
								>
									{dots.map((dot, i) => (
										<View
											key={i}
											style={{
												width: 5,
												height: 5,
												borderRadius: 2.5,
												backgroundColor: dot.color,
											}}
										/>
									))}
								</View>
							)}
						</TouchableOpacity>
					);
				})}
			</View>
		</View>
	);
};
