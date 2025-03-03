import React, {
	useRef,
	useCallback,
	useState,
	useEffect,
	useMemo,
} from "react";
import {
	StyleSheet,
	View,
	Text,
	TouchableOpacity,
	Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
	ExpandableCalendar,
	AgendaList,
	CalendarProvider,
	WeekCalendar,
} from "react-native-calendars";
import BottomSheet from "@gorhom/bottom-sheet";
import { BottomSheetView } from "@gorhom/bottom-sheet";
import DropDownPicker from "react-native-dropdown-picker";
import moment from "moment";
import { SafeAreaView } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	getAgendaItems,
	getMarkedDates,
	AgendaItemData,
} from "./components/agendaItemController";
import AgendaItem from "./components/AgendaItem";
import { getTheme, lightThemeColor } from "./theme";
import LoadingScreen from "../../LoadingScreen";
import {
	subscribeCurrentUser,
	getUserPrivilege,
	getUser,
	User,
} from "../../../controllers/userController";
import { subscribeEvents } from "../../../controllers/eventController";
import { subscribeAllUsersInCompany } from "../../../controllers/companyController";
import { LogBox } from "react-native";
import { Filter, PlusCircle } from "react-native-feather";

// Add this near the top of your file, after imports
LogBox.ignoreLogs([
	"ExpandableCalendar: Support for defaultProps will be removed from function components",
]);

type CalendarProps = {
	weekView?: any;
};

type FilterType = "my" | "specific" | "unassigned" | "all";

const today = moment().format("YYYY-MM-DD");
const leftArrowIcon = require("../../../assets/previous.png");
const rightArrowIcon = require("../../../assets/next.png");

const getFilterStyle = (type: FilterType, currentFilter: FilterType) => ({
	backgroundColor: type === currentFilter ? "#e0e0e0" : "#f5f5f5",
	borderColor: type === currentFilter ? "#2089dc" : "#ccc",
});

const ExpandableCalendarScreen = ({
	weekView,
	navigation,
}: CalendarProps & { navigation: any }) => {
	const [agendaItems, setAgendaItems] = useState<AgendaItemData[]>([]);
	const [selectedDate, setSelectedDate] = useState(today);
	const [markedDates, setMarkedDates] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState<User | null>(null);
	const [userId, setUserId] = useState<string>("");
	const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
	const [userPrivilege, setUserPrivilege] = useState<string>("");
	const [filterType, setFilterType] = useState<FilterType>("all");
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	const [availableWorkers, setAvailableWorkers] = useState([]);
	const [openSelect, setOpenSelect] = useState(false);
	const [bottomSheetPosition, setBottomSheetPosition] = useState(-1);
	const [showAllSelectedOnly, setShowAllSelectedOnly] = useState(false);
	const [showExactSelectedOnly, setShowExactSelectedOnly] = useState(false);

	const fabOpacity = useRef(new Animated.Value(1)).current;

	const theme = useRef(getTheme());
	const bottomSheetRef = useRef<BottomSheet>(null);
	const snapPoints = useMemo(() => ["65%", "90%"], []);

	const handleEventsUpdate = useCallback((snapshot: { docs: any }) => {
		const events = snapshot.docs;
		const items = getAgendaItems(events);
		const marks = getMarkedDates(items);
		setAgendaItems(items);
		setMarkedDates(marks);
	}, []);

	const closeBottomSheet = () => {
		bottomSheetRef.current?.close();
		setBottomSheetPosition(-1);
		setIsBottomSheetVisible(false);
		Animated.timing(fabOpacity, {
			toValue: 1,
			duration: 200,
			useNativeDriver: true,
		}).start();
	};

	const handleFilterPress = useCallback(() => {
		if (isBottomSheetVisible) {
			closeBottomSheet();
		} else {
			Animated.timing(fabOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}).start();
			bottomSheetRef.current?.snapToIndex(0);
			setBottomSheetPosition(0);
			setIsBottomSheetVisible(true);
		}
	}, [isBottomSheetVisible, fabOpacity]);

	const handleSheetChanges = useCallback(
		(index: number) => {
			setIsBottomSheetVisible(index !== -1);
			setBottomSheetPosition(index);
			if (index === -1) {
				Animated.timing(fabOpacity, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}).start();
			}
		},
		[fabOpacity]
	);

	const handleFilterChange = (type: FilterType) => {
		setFilterType(type);
		if (type === "specific" && !selectedUsers.length) {
			return;
		}
		closeBottomSheet();
	};

	const checkSelectOpen = () => {
		setOpenSelect(!openSelect);
		if (!openSelect) {
			bottomSheetRef.current?.snapToIndex(1);
			setBottomSheetPosition(1);
		}
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

	useEffect(() => {
		if (filterType === "specific" && selectedUsers.length > 1) {
			bottomSheetRef.current?.snapToIndex(1);
			setBottomSheetPosition(1);
		}
	}, [selectedUsers.length, filterType]);

	useEffect(() => {
		if (!user?.loggedInCompany || !userId) return;

		let userIds = [userId];
		if (filterType === "specific") {
			userIds = selectedUsers.length > 0 ? selectedUsers : [userId];

			const filterOptions = {
				requireAllSelected: showAllSelectedOnly,
				exactMatchOnly: showExactSelectedOnly,
			};

			const unsubscribe = subscribeEvents(
				filterType,
				user.loggedInCompany,
				userIds,
				handleEventsUpdate,
				filterOptions
			);
			return () => unsubscribe?.();
		} else if (filterType === "unassigned" || filterType === "all") {
			userIds = [];
		}

		const unsubscribe = subscribeEvents(
			filterType,
			user.loggedInCompany,
			userIds,
			handleEventsUpdate
		);

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [
		filterType,
		user?.loggedInCompany,
		userId,
		selectedUsers,
		showAllSelectedOnly,
		showExactSelectedOnly,
		handleEventsUpdate,
	]);

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

	const isAdmin = userPrivilege === "Admin" || userPrivilege === "Owner";

	if (isLoading) {
		return <LoadingScreen />;
	}

	return (
		<GestureHandlerRootView style={styles.rootView}>
			<View style={styles.container}>
				<SafeAreaView style={styles.safeArea}>
					{user ? (
						<CalendarProvider
							date={selectedDate}
							showTodayButton={true}
							todayButtonStyle={styles.todayButton}
						>
							<View style={styles.calendarContainer}>
								{weekView ? (
									<WeekCalendar
										firstDay={1}
										markedDates={markedDates}
									/>
								) : (
									<ExpandableCalendar
										horizontal={true}
										pagingEnabled={true}
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
										<View
											style={{ paddingVertical: 150 }}
										/>
									}
								/>
							</View>
						</CalendarProvider>
					) : (
						<LoadingScreen />
					)}

					<BottomSheet
						ref={bottomSheetRef}
						snapPoints={snapPoints}
						onChange={handleSheetChanges}
						enablePanDownToClose={true}
						index={bottomSheetPosition}
					>
						<BottomSheetView style={styles.contentContainer}>
							<View style={styles.bottomSheetHandle} />
							{filterType === "specific" ? (
								<View style={styles.dropdownWrapper}>
									<View style={styles.headerRow}>
										<TouchableOpacity
											onPress={() => {
												setShowAllSelectedOnly(false);
												setShowExactSelectedOnly(false);
												setSelectedUsers([]);
												setOpenSelect(false);
												setFilterType("my");
												setTimeout(() => {
													bottomSheetRef.current?.snapToIndex(
														0
													);
													setBottomSheetPosition(0);
												}, 100);
											}}
										>
											<Text style={styles.backButton}>
												← Back
											</Text>
										</TouchableOpacity>
										<Text style={styles.filterTitle}>
											Select Users
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

									{selectedUsers.length > 1 && (
										<View style={styles.checkboxContainer}>
											<TouchableOpacity
												style={styles.checkboxRow}
												onPress={() => {
													setShowAllSelectedOnly(
														(prev) => !prev
													);
													if (!showAllSelectedOnly) {
														setShowExactSelectedOnly(
															false
														);
													}
												}}
											>
												<View
													style={[
														styles.checkbox,
														showAllSelectedOnly &&
															styles.checkboxSelected,
													]}
												>
													{showAllSelectedOnly && (
														<Text
															style={
																styles.checkmark
															}
														>
															✓
														</Text>
													)}
												</View>
												<Text
													style={styles.checkboxLabel}
												>
													Together
												</Text>
											</TouchableOpacity>

											<TouchableOpacity
												style={styles.checkboxRow}
												onPress={() => {
													setShowExactSelectedOnly(
														(prev) => !prev
													);
													if (
														!showExactSelectedOnly
													) {
														setShowAllSelectedOnly(
															false
														);
													}
												}}
											>
												<View
													style={[
														styles.checkbox,
														showExactSelectedOnly &&
															styles.checkboxSelected,
													]}
												>
													{showExactSelectedOnly && (
														<Text
															style={
																styles.checkmark
															}
														>
															✓
														</Text>
													)}
												</View>
												<Text
													style={styles.checkboxLabel}
												>
													Exclusively Together
												</Text>
											</TouchableOpacity>
										</View>
									)}

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
				{isAdmin && (
					<>
						<Animated.View
							style={{ opacity: fabOpacity }}
							pointerEvents={
								isBottomSheetVisible ? "none" : "auto"
							}
						>
							<TouchableOpacity
								style={styles.addEventButton}
								onPress={() =>
									navigation.navigate("EditEvent", {
										event: null,
									})
								}
							>
								<PlusCircle
									stroke="black"
									width={24}
									height={24}
								/>
							</TouchableOpacity>
						</Animated.View>
						<Animated.View
							style={{ opacity: fabOpacity }}
							pointerEvents={
								isBottomSheetVisible ? "none" : "auto"
							}
						>
							<TouchableOpacity
								style={styles.filterButton}
								onPress={handleFilterPress}
							>
								<Filter stroke="black" width={24} height={24} />
							</TouchableOpacity>
						</Animated.View>
					</>
				)}
			</View>
		</GestureHandlerRootView>
	);
};

const styles = StyleSheet.create({
	rootView: {
		flex: 1,
		backgroundColor: "white",
	},
	container: {
		flex: 1,
		backgroundColor: "white",
	},
	safeArea: {
		flex: 1,
	},
	calendar: {
		paddingLeft: 20,
		paddingRight: 20,
	},
	section: {
		backgroundColor: lightThemeColor,
		color: "grey",
		textTransform: "capitalize",
	},
	calendarContainer: {
		position: "relative",
		//height: 300,
		zIndex: 1000,
	},
	agendaContainer: {
		flex: 1,
	},
	contentContainer: {
		flex: 1,
		padding: 24,
		paddingBottom: 10,
		alignItems: "center",
		minHeight: "100%",
	},
	scrollableContent: {
		width: "100%",
		flex: 1,
	},
	filterButton: {
		position: "absolute",
		bottom: 10,
		right: 70, // Changed from right: 10 to position it to the left
		zIndex: 999,
		padding: 12,
		backgroundColor: "white",
		borderRadius: 30,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 8,
	},
	bottomSheetHandle: {
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#DEDEDE",
		alignSelf: "center",
		marginBottom: 20,
		display: "none",
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
	checkboxContainer: {
		marginTop: 16,
		width: "100%",
	},
	checkboxRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		marginBottom: 12,
		paddingHorizontal: 4,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 4,
		borderWidth: 2,
		borderColor: "#2089dc",
		marginRight: 10,
		marginTop: 2,
		justifyContent: "center",
		alignItems: "center",
	},
	checkboxSelected: {
		backgroundColor: "#2089dc",
	},
	checkmark: {
		color: "white",
		fontSize: 14,
	},
	checkboxLabel: {
		flex: 1,
		fontSize: 14,
		lineHeight: 20,
	},
	todayButton: {
		bottom: 0,
	},
	addEventButton: {
		position: "absolute",
		bottom: 10,
		right: 10, // Changed from right: 70 to position it on the right
		zIndex: 999,
		padding: 12,
		backgroundColor: "white",
		borderRadius: 30,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 8,
	},
});

export default ExpandableCalendarScreen;
