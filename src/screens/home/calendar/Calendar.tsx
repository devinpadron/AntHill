import React, { useRef, useCallback, useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import {
	ExpandableCalendar,
	AgendaList,
	CalendarProvider,
	WeekCalendar,
} from "react-native-calendars";
import {
	getAgendaItems,
	getMarkedDates,
	AgendaItemData,
} from "./components/agendaItemController";
import AgendaItem from "./components/AgendaItem";
import { getTheme, themeColor, lightThemeColor } from "./theme";
import moment from "moment";
import LoadingScreen from "../../LoadingScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomSheet from "@gorhom/bottom-sheet";
import { Portal } from "@gorhom/portal";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import DropDownPicker from "react-native-dropdown-picker";
import {
	getUserPrivilege,
	subscribeCurrentUser,
	getUser,
	User,
} from "../../../controllers/userController";
import { subscribeEvents } from "../../../controllers/eventController";
import { subscribeAllUsersInCompany } from "../../../controllers/companyController";

type FilterType = "admin_and_unassigned" | "specific_users" | "all_events";

const today = moment().format("YYYY-MM-DD");
const leftArrowIcon = require("../../../assets/previous.png");
const rightArrowIcon = require("../../../assets/next.png");

type CalendarProps = {
	weekView?: any;
};

const ExpandableCalendarScreen = ({ weekView }: CalendarProps) => {
	// Calendar states
	const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
	const [selectedDate, setSelectedDate] = useState(today);
	const [markedDates, setMarkedDates] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState<User | null>(null);
	const theme = useRef(getTheme());

	// Filter states
	const [isAdmin, setIsAdmin] = useState(false);
	const [showFilterSheet, setShowFilterSheet] = useState(false);
	const [currentFilter, setCurrentFilter] = useState<FilterType>(
		"admin_and_unassigned"
	);
	const [selectedFilterUsers, setSelectedFilterUsers] = useState<string[]>(
		[]
	);
	const [openSelect, setOpenSelect] = useState(false);
	const [availableWorkers, setAvailableWorkers] = useState([]);

	// Bottom sheet reference
	const bottomSheetRef = useRef<BottomSheet>(null);
	const snapPoints = ["50%"];

	// Load users for filter dropdown
	useEffect(() => {
		if (!user?.loggedInCompany) return;

		const subscriber = subscribeAllUsersInCompany(
			user.loggedInCompany,
			async (snapshot) => {
				const workers = await Promise.all(
					snapshot.docs.map(async (doc) => {
						const userData = await getUser(doc.id);
						return {
							label: `${userData.firstName} ${userData.lastName}`,
							value: doc.id,
						};
					})
				);
				setAvailableWorkers(workers);
			}
		);

		return () => subscriber();
	}, [user?.loggedInCompany]);

	// Main subscription for user and events
	useEffect(() => {
		const subscriber = subscribeCurrentUser(async (userSnapshot) => {
			try {
				if (!userSnapshot.exists) return;
				const userData = userSnapshot.data() as User;
				setUser(userData);

				const privilege = await getUserPrivilege(
					userSnapshot.id,
					userData.loggedInCompany
				);

				if (privilege === "Admin" || privilege === "Owner") {
					setIsAdmin(true);
					setCurrentFilter("admin_and_unassigned");
				} else {
					setIsAdmin(false);
				}

				const userIDs: string[] = [];
				userIDs.push(userSnapshot.id);
				subscribeEvents(
					userData.loggedInCompany,
					userIDs,
					privilege,
					(snapshot: { docs: any }) => {
						const events = snapshot.docs;
						const items = getAgendaItems(events);
						const marks = getMarkedDates(items);
						setAgendaItems(items);
						setMarkedDates(marks);
					}
				);
			} catch (error) {
				console.error(error);
			}
		});

		return () => subscriber();
	}, []);

	useEffect(() => {
		if (user) {
			setIsLoading(false);
		}
	}, [user]);

	const handleFilterChange = (
		filterType: FilterType,
		selectedUsers?: string[]
	) => {
		setCurrentFilter(filterType);
		if (selectedUsers) {
			setSelectedFilterUsers(selectedUsers);
		}
		// Close the bottom sheet after selection
		setShowFilterSheet(false);
	};

	const handleUserSelect = useCallback((users: string[]) => {
		setSelectedFilterUsers(users);
		handleFilterChange("specific_users", users);
	}, []);

	const sortedSections = agendaItems
		.reduce((acc, item) => {
			const existing = acc.find((x) => x.title === item.date);
			if (existing) {
				existing.data.push(...item.data);
			} else {
				acc.push({
					title: item.date,
					data: [...item.data],
				});
			}
			return acc;
		}, [] as { title: string; data: any[] }[])
		.sort((a, b) => {
			return new Date(a.title).getTime() - new Date(b.title).getTime();
		});

	const renderItem = useCallback(({ item }: { item: AgendaItemData }) => {
		return <AgendaItem item={item} />;
	}, []);

	const renderFilterBottomSheet = () => (
		<Portal>
			<BottomSheet
				ref={bottomSheetRef}
				index={showFilterSheet ? 0 : -1}
				snapPoints={snapPoints}
				enablePanDownToClose
				onClose={() => setShowFilterSheet(false)}
			>
				<View style={styles.bottomSheetContainer}>
					<View style={styles.header}>
						<Text style={styles.title}>Filter Events</Text>
						<TouchableOpacity
							onPress={() => setShowFilterSheet(false)}
							style={styles.closeButton}
						>
							<Ionicons name="close" size={24} color="#555" />
						</TouchableOpacity>
					</View>

					<TouchableOpacity
						style={[
							styles.filterOption,
							currentFilter === "admin_and_unassigned" &&
								styles.selectedOption,
						]}
						onPress={() =>
							handleFilterChange("admin_and_unassigned")
						}
					>
						<Text style={styles.filterText}>
							My Events & All Unassigned Events
						</Text>
						{currentFilter === "admin_and_unassigned" && (
							<Ionicons name="checkmark" size={24} color="#555" />
						)}
					</TouchableOpacity>

					<View style={[styles.filterOption, { zIndex: 3000 }]}>
						<TouchableOpacity
							style={[
								styles.filterOptionHeader,
								currentFilter === "specific_users" &&
									styles.selectedOption,
							]}
							onPress={() => handleFilterChange("specific_users")}
						>
							<Text style={styles.filterText}>
								View Specific Users' Events
							</Text>
							{currentFilter === "specific_users" && (
								<Ionicons
									name="checkmark"
									size={24}
									color="#555"
								/>
							)}
						</TouchableOpacity>

						{currentFilter === "specific_users" && (
							<View style={styles.dropdownContainer}>
								<DropDownPicker
									searchPlaceholder="Search users"
									multiple={true}
									min={1}
									max={5}
									value={selectedFilterUsers}
									setValue={setSelectedFilterUsers}
									items={availableWorkers}
									setItems={setAvailableWorkers}
									open={openSelect}
									setOpen={setOpenSelect}
									mode="BADGE"
									listMode="SCROLLVIEW"
									searchable={true}
									style={styles.dropdown}
									dropDownContainerStyle={styles.dropdownList}
									listItemContainerStyle={styles.dropdownItem}
									zIndex={3000}
									placeholder="Select users"
									onChangeValue={(value) =>
										handleUserSelect(value as string[])
									}
								/>
							</View>
						)}
					</View>

					<TouchableOpacity
						style={[
							styles.filterOption,
							currentFilter === "all_events" &&
								styles.selectedOption,
						]}
						onPress={() => handleFilterChange("all_events")}
					>
						<Text style={styles.filterText}>
							All Company Events
						</Text>
						{currentFilter === "all_events" && (
							<Ionicons name="checkmark" size={24} color="#555" />
						)}
					</TouchableOpacity>
				</View>
			</BottomSheet>
		</Portal>
	);

	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaView style={styles.container}>
				<CalendarProvider date={selectedDate} showTodayButton={true}>
					<View style={styles.calendarContainer}>
						{isAdmin === true && (
							<TouchableOpacity
								style={styles.filterButton}
								onPress={() => {
									console.log("Filter button pressed"); // Debug log
									setShowFilterSheet(true);
								}}
							>
								<Ionicons
									name="filter"
									size={24}
									color="#555"
								/>
							</TouchableOpacity>
						)}

						{weekView ? (
							<WeekCalendar
								firstDay={1}
								markedDates={markedDates}
							/>
						) : (
							<ExpandableCalendar
								horizontal
								pagingEnabled
								initialPosition={
									ExpandableCalendar.positions.OPEN
								}
								calendarStyle={styles.calendar}
								theme={theme.current}
								firstDay={1}
								markedDates={markedDates}
								leftArrowImageSource={leftArrowIcon}
								rightArrowImageSource={rightArrowIcon}
								closeOnDayPress={false}
								date={selectedDate}
								onDayPress={(day) =>
									setSelectedDate(day.dateString)
								}
							/>
						)}
					</View>

					<View style={styles.agendaContainer}>
						<AgendaList
							sections={sortedSections}
							renderItem={renderItem}
							sectionStyle={styles.section}
							ListFooterComponent={
								<View style={{ paddingVertical: 150 }} />
							}
						/>
					</View>

					{isAdmin && renderFilterBottomSheet()}
				</CalendarProvider>
			</SafeAreaView>
		</GestureHandlerRootView>
	);
};

const styles = StyleSheet.create({
	calendar: {
		paddingLeft: 20,
		paddingRight: 20,
	},
	section: {
		backgroundColor: lightThemeColor,
		color: "grey",
		textTransform: "capitalize",
	},
	container: {
		flex: 1,
	},
	calendarContainer: {
		position: "relative",
	},
	agendaContainer: {
		flex: 1,
	},
	filterButton: {
		position: "absolute",
		top: 10,
		right: 20,
		zIndex: 1000,
		backgroundColor: "white",
		padding: 8,
		borderRadius: 8,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	bottomSheetContainer: {
		flex: 1,
		padding: 16,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 20,
	},
	title: {
		fontSize: 20,
		fontWeight: "bold",
		color: "#333",
	},
	closeButton: {
		padding: 4,
	},
	filterOption: {
		marginBottom: 16,
		borderRadius: 8,
		backgroundColor: "#fff",
		padding: 16,
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.2,
		shadowRadius: 1.41,
		elevation: 2,
	},
	filterOptionHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	selectedOption: {
		borderColor: "#555",
		borderWidth: 2,
	},
	filterText: {
		fontSize: 16,
		color: "#333",
	},
	dropdownContainer: {
		marginTop: 12,
	},
	dropdown: {
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 8,
	},
	dropdownList: {
		borderColor: "#ccc",
		backgroundColor: "#fff",
		borderRadius: 8,
	},
	dropdownItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
	},
});

export default ExpandableCalendarScreen;
