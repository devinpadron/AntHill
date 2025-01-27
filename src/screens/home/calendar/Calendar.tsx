import React, {
	useRef,
	useCallback,
	useState,
	useEffect,
	useMemo,
} from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import {
	ExpandableCalendar,
	AgendaList,
	CalendarProvider,
	WeekCalendar,
} from "react-native-calendars";
import BottomSheet from "@gorhom/bottom-sheet";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import { Filter } from "react-native-feather";
import DropDownPicker from "react-native-dropdown-picker";
import {
	getAgendaItems,
	getMarkedDates,
	AgendaItemData,
} from "./components/agendaItemController";
import AgendaItem from "./components/AgendaItem";
import { getTheme, lightThemeColor } from "./theme";
import moment from "moment";
import LoadingScreen from "../../LoadingScreen";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	subscribeCurrentUser,
	getUserPrivilege,
	getUser,
	User,
} from "../../../controllers/userController";
import { subscribeEvents } from "../../../controllers/eventController";
import { subscribeAllUsersInCompany } from "../../../controllers/companyController";

const today = moment().format("YYYY-MM-DD");
const leftArrowIcon = require("../../../assets/previous.png");
const rightArrowIcon = require("../../../assets/next.png");

type CalendarProps = {
	weekView?: any;
};

type FilterType = "my" | "specific" | "unassigned" | "all";

const getFilterStyle = (type: FilterType, currentFilter: FilterType) => ({
	backgroundColor: type === currentFilter ? "#e0e0e0" : "#f5f5f5",
	borderColor: type === currentFilter ? "#2089dc" : "#ccc",
});

const ExpandableCalendarScreen = ({ weekView }: CalendarProps) => {
	const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
	const [selectedDate, setSelectedDate] = useState(today);
	const [markedDates, setMarkedDates] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState<User | null>(null);
	const [userId, setUserId] = useState<string>("");
	const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
	const [userPrivilege, setUserPrivilege] = useState<string>("");
	const [filterType, setFilterType] = useState<FilterType>("my");
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	const [availableWorkers, setAvailableWorkers] = useState([]);
	const [openSelect, setOpenSelect] = useState(false);
	const [bottomSheetPosition, setBottomSheetPosition] = useState(-1);
	const theme = useRef(getTheme());

	const bottomSheetRef = useRef<BottomSheet>(null);
	const snapPoints = useMemo(() => ["65%", "90%"], []);

	const closeBottomSheet = () => {
		bottomSheetRef.current?.close();
		setBottomSheetPosition(-1);
		setIsBottomSheetVisible(false);
	};

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

	const handleFilterPress = useCallback(() => {
		if (isBottomSheetVisible) {
			closeBottomSheet();
		} else {
			bottomSheetRef.current?.expand();
			setBottomSheetPosition(0);
			setIsBottomSheetVisible(true);
		}
	}, [isBottomSheetVisible]);

	const handleSheetChanges = useCallback((index: number) => {
		setIsBottomSheetVisible(index !== -1);
		setBottomSheetPosition(index);
	}, []);

	const handleEventsUpdate = (snapshot: { docs: any }) => {
		const events = snapshot.docs;
		const items = getAgendaItems(events);
		const marks = getMarkedDates(items);
		setAgendaItems(items);
		setMarkedDates(marks);
	};

	const handleFilterChange = (type: FilterType) => {
		setFilterType(type);
		if (type === "my" && user) {
		} else if (type === "specific" && selectedUsers.length > 0) {
		} else if (type === "unassigned" && user) {
		} else if (type === "all" && user) {
		}
		closeBottomSheet();
	};

	const checkSelectOpen = () => {
		setOpenSelect(!openSelect);
		if (!openSelect) {
			setBottomSheetPosition(1);
		}
	};

	useEffect(() => {
		const subscriber = subscribeCurrentUser(async (userSnapshot) => {
			try {
				if (!userSnapshot.exists) return;
				const userData = userSnapshot.data() as User;
				setUser(userData);
				setUserId(userSnapshot.id);
				const privilege = await getUserPrivilege(
					userSnapshot.id,
					userData.loggedInCompany
				);
				setUserPrivilege(privilege || "User");
				subscribeEvents(
					userData.loggedInCompany,
					[userSnapshot.id],
					"User",
					handleEventsUpdate
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
		.sort(
			(a, b) => new Date(a.title).getTime() - new Date(b.title).getTime()
		);

	const renderItem = useCallback(({ item }: { item: AgendaItemData }) => {
		return <AgendaItem item={item} />;
	}, []);

	const showFilterButton =
		userPrivilege === "Admin" || userPrivilege === "Owner";

	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<GestureHandlerRootView style={styles.rootView}>
			<View style={styles.container}>
				<SafeAreaView style={styles.safeArea}>
					{showFilterButton && (
						<TouchableOpacity
							style={styles.filterButton}
							onPress={handleFilterPress}
						>
							<Filter stroke="black" width={24} height={24} />
						</TouchableOpacity>
					)}

					<CalendarProvider
						date={selectedDate}
						showTodayButton={true}
					>
						<View style={styles.calendarContainer}>
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
					</CalendarProvider>

					<BottomSheet
						ref={bottomSheetRef}
						snapPoints={snapPoints}
						onChange={handleSheetChanges}
						enablePanDownToClose={true}
						index={bottomSheetPosition}
					>
						<BottomSheetView style={styles.contentContainer}>
							{filterType === "specific" ? (
								<View style={styles.dropdownWrapper}>
									<View style={styles.headerRow}>
										<TouchableOpacity
											onPress={() => {
												setFilterType("my");
												setBottomSheetPosition(0);
											}}
										>
											<Text style={styles.backButton}>
												← Back
											</Text>
										</TouchableOpacity>
										<Text style={styles.filterTitle}>
											Assigned Workers
										</Text>
									</View>
									<DropDownPicker
										searchPlaceholder="Search"
										multiple={true}
										min={0}
										max={5}
										value={selectedUsers}
										setValue={setSelectedUsers}
										items={availableWorkers}
										setItems={setAvailableWorkers}
										open={openSelect}
										setOpen={checkSelectOpen}
										mode="BADGE"
										listMode="SCROLLVIEW"
										searchable={true}
										maxHeight={200}
										style={styles.dropdown}
										dropDownContainerStyle={
											styles.dropdownList
										}
										listItemContainerStyle={
											styles.dropdownItem
										}
										zIndex={3000}
										placeholder="Select Users"
									/>
									<TouchableOpacity
										style={styles.applyButton}
										onPress={() =>
											handleFilterChange("specific")
										}
									>
										<Text style={styles.applyButtonText}>
											Apply Filter
										</Text>
									</TouchableOpacity>
								</View>
							) : (
								<>
									<Text style={styles.filterTitle}>
										Event Filters
									</Text>
									<TouchableOpacity
										style={[
											styles.filterOption,
											getFilterStyle("my", filterType),
										]}
										onPress={() => handleFilterChange("my")}
									>
										<Text style={styles.filterText}>
											My Events
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={[
											styles.filterOption,
											getFilterStyle(
												"specific",
												filterType
											),
										]}
										onPress={() =>
											setFilterType("specific")
										}
									>
										<Text style={styles.filterText}>
											Specific Users
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={[
											styles.filterOption,
											getFilterStyle(
												"unassigned",
												filterType
											),
										]}
										onPress={() =>
											handleFilterChange("unassigned")
										}
									>
										<Text style={styles.filterText}>
											Unassigned Events
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										style={[
											styles.filterOption,
											getFilterStyle("all", filterType),
										]}
										onPress={() =>
											handleFilterChange("all")
										}
									>
										<Text style={styles.filterText}>
											All Events
										</Text>
									</TouchableOpacity>
								</>
							)}
						</BottomSheetView>
					</BottomSheet>
				</SafeAreaView>
			</View>
		</GestureHandlerRootView>
	);
};

const styles = StyleSheet.create({
	rootView: { flex: 1, backgroundColor: "white" },
	container: { flex: 1, backgroundColor: "white" },
	safeArea: { flex: 1 },
	calendar: { paddingLeft: 20, paddingRight: 20 },
	section: {
		backgroundColor: lightThemeColor,
		color: "grey",
		textTransform: "capitalize",
	},
	calendarContainer: { position: "relative" },
	agendaContainer: { flex: 1 },
	contentContainer: {
		flex: 1,
		padding: 24,
		paddingBottom: 10,
		alignItems: "center",
	},
	filterButton: {
		position: "absolute",
		top: 25,
		right: 60,
		zIndex: 1,
		padding: 8,
		backgroundColor: "white",
		borderRadius: 8,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	filterTitle: {
		fontSize: 20,
		fontWeight: "600",
		marginBottom: 20,
		width: "100%",
		textAlign: "center",
	},
	filterOption: {
		padding: 16,
		borderRadius: 8,
		marginBottom: 12,
		width: "100%",
		borderWidth: 1,
	},
	filterText: {
		fontSize: 16,
		textAlign: "center",
	},
	headerRow: {
		flexDirection: "column",
		alignItems: "flex-start",
		marginBottom: 20,
		width: "100%",
	},
	backButton: {
		fontSize: 16,
		color: "#2089dc",
		marginBottom: 10,
	},
	dropdownWrapper: {
		zIndex: 2000,
		width: "100%",
	},
	dropdown: {
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		backgroundColor: "white",
		minHeight: 50,
	},
	dropdownList: {
		borderColor: "#ccc",
		borderWidth: 1,
		borderRadius: 10,
		backgroundColor: "white",
		marginTop: 1,
		position: "relative",
		top: 0,
	},
	dropdownItem: {
		padding: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		minHeight: 40,
		justifyContent: "center",
	},
	applyButton: {
		backgroundColor: "#2089dc",
		padding: 16,
		borderRadius: 8,
		marginTop: 20,
		width: "100%",
		alignItems: "center",
	},
	applyButtonText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
});

export default ExpandableCalendarScreen;
