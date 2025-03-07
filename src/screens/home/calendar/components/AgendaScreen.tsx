import React, { useCallback, useMemo, useState } from "react";
import {
	StyleSheet,
	Text,
	View,
	TouchableOpacity,
	RefreshControl,
} from "react-native";
import { Agenda, DateData } from "react-native-calendars";
import { AgendaItem } from "./agendaItemController";
import moment from "moment";

type AgendaScreenProps = {
	markedDates: Record<string, any>;
	agendaItems: AgendaItem;
	selectedDate: string;
	onDayPress: (day: DateData) => void;
	navigation: any;
	onRefreshData: () => Promise<void>;
};

export const AgendaScreen = ({
	markedDates,
	agendaItems,
	selectedDate,
	onDayPress,
	navigation,
	onRefreshData,
}: AgendaScreenProps) => {
	const [refreshing, setRefreshing] = useState(false);

	// Handle pull-to-refresh
	const handleRefresh = useCallback(async () => {
		if (!onRefreshData) return;

		setRefreshing(true);
		try {
			await onRefreshData();
		} catch (error) {
			console.error("Error refreshing:", error);
		} finally {
			setRefreshing(false);
		}
	}, [onRefreshData]);

	const sortedAgendaItems = useMemo(() => {
		const sorted = { ...agendaItems };

		// Go through each date
		Object.keys(sorted).forEach((date) => {
			if (sorted[date] && Array.isArray(sorted[date])) {
				// Sort the items for this date
				sorted[date] = [...sorted[date]].sort((a, b) => {
					// All Day events (no startTime) come first
					if (!a.startTime && b.startTime) return -1;
					if (a.startTime && !b.startTime) return 1;
					if (!a.startTime && !b.startTime) return 0; // Both are All Day

					// Convert time strings to comparable values
					const timeA = moment(a.startTime, "HH:mm").valueOf();
					const timeB = moment(b.startTime, "HH:mm").valueOf();
					return timeA - timeB;
				});
			}
		});

		return sorted;
	}, [agendaItems]);
	return (
		<Agenda
			items={sortedAgendaItems}
			renderItem={(item, firstItemInDay) => {
				console.log(item);
				return (
					<TouchableOpacity
						style={styles.agendaItem}
						onPress={() => {
							navigation.navigate("Details", {
								uid: item.uid,
							});
						}}
					>
						<View style={styles.agendaItemInner}>
							<Text
								style={[
									styles.agendaItemTitle,
									{
										fontWeight: firstItemInDay
											? "600"
											: "400",
									},
								]}
							>
								{item.title}
							</Text>
							<Text style={styles.agendaItemTime}>
								{item.startTime
									? item.endTime
										? `${moment(
												item.startTime,
												"hh:mm"
										  ).format("h:mm A")} - ${moment(
												item.endTime,
												"hh:mm"
										  ).format("h:mm A")}`
										: `${moment(
												item.startTime,
												"hh:mm"
										  ).format("h:mm A")}`
									: "All Day"}
							</Text>
							{item.duration && (
								<Text style={styles.agendaItemAssignees}>
									{item.duration} Hours
								</Text>
							)}
						</View>
					</TouchableOpacity>
				);
			}}
			renderEmptyDate={() => (
				<View
					style={{
						height: 1,
						backgroundColor: "#000",
						opacity: 0.1,
						width: "80%",
						marginTop: 10,
					}}
				/>
			)}
			rowHasChanged={(r1, r2) => r1.id !== r2.id}
			markedDates={markedDates}
			theme={{
				agendaDayTextColor: "#2d4150",
				agendaDayNumColor: "#2d4150",
				agendaTodayColor: "#2089dc",
				agendaKnobColor: "#2089dc",
				backgroundColor: "#ffffff",
				calendarBackground: "#ffffff",
				todayBackgroundColor: "#e6f2ff",
				selectedDayBackgroundColor: "#2089dc",
			}}
			showClosingKnob={true}
			hideKnob={false}
			showOnlySelectedDayItems={false}
			selected={selectedDate}
			onDayPress={onDayPress}
			refreshControl={
				<RefreshControl
					refreshing={refreshing}
					onRefresh={handleRefresh}
					colors={["#2089dc"]}
				/>
			}
		/>
	);
};

const styles = StyleSheet.create({
	item: {
		backgroundColor: "white",
		flex: 1,
		borderRadius: 5,
		padding: 10,
		marginRight: 10,
		marginTop: 17,
	},
	customDay: {
		margin: 10,
		fontSize: 24,
		color: "green",
	},
	dayItem: {
		marginLeft: 34,
	},
	agendaItem: {
		backgroundColor: "white",
		borderRadius: 8,
		padding: 10,
		marginRight: 10,
		marginTop: 10,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.22,
		shadowRadius: 2.22,
		elevation: 3,
	},
	agendaItemInner: {
		flex: 1,
	},
	agendaItemTitle: {
		fontSize: 16,
		marginBottom: 5,
	},
	agendaItemTime: {
		fontSize: 14,
		color: "#666",
		marginBottom: 5,
	},
	agendaItemAssignees: {
		fontSize: 12,
		color: "#888",
	},
	emptyDate: {
		height: 80,
		flex: 1,
		paddingTop: 30,
		alignItems: "center",
	},
});
