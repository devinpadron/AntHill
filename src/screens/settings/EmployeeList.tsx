import React, { useCallback, useEffect, useState } from "react";
import {
	View,
	Text,
	FlatList,
	StyleSheet,
	LayoutAnimation,
	UIManager,
	Platform,
	Alert,
	ActivityIndicator,
	RefreshControl,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { LongPressGestureHandler, State } from "react-native-gesture-handler";
import {
	getUser,
	subscribeCurrentUser,
	updateUser,
} from "../../controllers/userController";
import {
	removeUserFromCompany,
	subscribeAllUsersInCompany,
} from "../../controllers/companyController";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EmployeeList = ({ navigation }) => {
	const [expandedIndex, setExpandedIndex] = useState(null);
	const [employees, setEmployees] = useState<
		Record<
			string,
			{
				companies: Record<string, string>;
				firstName: string;
				lastName: string;
				email: string;
			}
		>
	>({});
	const [user, setUser] = useState(null);
	const [loggedInCompany, setLoggedInCompany] = useState(null);
	const [refreshing, setRefreshing] = useState(false);
	const insets = useSafeAreaInsets();

	useEffect(() => {
		if (!user) return;
		const subscriber = subscribeAllUsersInCompany(
			user.loggedInCompany,
			async (snapshot) => {
				const employeeData = {};
				for (const doc of snapshot.docs) {
					const data = await getUser(doc.id);
					const employeeJson = {
						id: doc.id, // Add the document ID as an id property
						...data,
					};
					employeeData[doc.id] = employeeJson;
				}
				setEmployees(employeeData);
			},
		);
		return () => subscriber();
	}, [user]);

	useEffect(() => {
		const subscriber = subscribeCurrentUser((snapshot) => {
			const userData = snapshot.data();
			setUser(userData);
			setLoggedInCompany(userData.loggedInCompany);
		});
		return () => subscriber();
	}, []);

	const onRefresh = useCallback(() => {
		setRefreshing(true);

		// Re-fetch the employee data
		if (user && loggedInCompany) {
			subscribeAllUsersInCompany(loggedInCompany, async (snapshot) => {
				const employeeData = {};
				for (const doc of snapshot.docs) {
					const data = await getUser(doc.id);
					const employeeJson = {
						id: doc.id,
						...data,
					};
					employeeData[doc.id] = employeeJson;
				}
				setEmployees(employeeData);
				setRefreshing(false);
			});
		} else {
			setRefreshing(false);
		}
	}, [user, loggedInCompany]);

	const sortedEmployees = Object.values(employees)
		.filter(
			(employee) =>
				employee &&
				employee.companies[loggedInCompany] &&
				employee.firstName,
		) // Filter out invalid entries
		.sort((a, b) => {
			const privilegeOrder = { Owner: 0, Admin: 1, User: 2 };
			if (
				privilegeOrder[a.companies[loggedInCompany]] !==
				privilegeOrder[b.companies[loggedInCompany]]
			) {
				return (
					privilegeOrder[a.companies[loggedInCompany]] -
					privilegeOrder[b.companies[loggedInCompany]]
				);
			}
			// Sorted by first name if same privilege
			return a.firstName.localeCompare(b.firstName);
		});

	const handlePress = (index) => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpandedIndex(expandedIndex === index ? null : index);
	};

	const handleLongPress = (employee) => {
		// Must check to see if current user is an owner before allowing them to demote or promote another user
		// Owners cannot be demoted, and only owners can promote users to admin
		const userPriv = user.companies[loggedInCompany];
		if (
			employee.companies[loggedInCompany] != "Owner" &&
			userPriv === "Owner"
		) {
			Alert.alert(
				employee.firstName + " " + employee.lastName,
				"What would you like to do?",
				[
					employee.companies[loggedInCompany] === "Admin"
						? {
								text: "Demote",
								onPress: () => {
									updateUser(employee.id, {
										...employee,
										companies: {
											[loggedInCompany]: "User",
										},
									});
									console.log(
										"Demoted",
										employee.firstName + employee.lastName,
									);
									onRefresh();
								},
							}
						: {
								text: "Promote",
								onPress: () => {
									updateUser(employee.id, {
										...employee,
										companies: {
											[loggedInCompany]: "Admin",
										},
									});
									console.log(
										"Promoted",
										employee.firstName + employee.lastName,
									);
									onRefresh();
								},
							},
					{
						text: "Delete",
						style: "destructive",
						onPress: () => {
							// TODO: Add confirmation dialog
							Alert.alert(
								"Confirm Delete",
								`Are you sure you want to remove ${employee.firstName} ${employee.lastName} from the company?`,
								[
									{
										text: "Cancel",
										style: "cancel",
									},
									{
										text: "Delete",
										style: "destructive",
										onPress: () => {
											removeUserFromCompany(
												loggedInCompany,
												employee.id,
											);
											console.log(
												"Deleted",
												employee.firstName +
													employee.lastName,
											);
											onRefresh();
										},
									},
								],
							);
						},
					},
					{
						text: "Cancel",
						style: "cancel",
					},
				],
			);
		}
	};

	const renderItem = ({ item, index }) => (
		<LongPressGestureHandler
			onHandlerStateChange={({ nativeEvent }) => {
				if (nativeEvent.state === State.ACTIVE) {
					handleLongPress(item);
				}
			}}
			minDurationMs={800}
		>
			<View>
				<TouchableOpacity onPress={() => handlePress(index)}>
					<View style={styles.item}>
						<Text style={styles.name}>
							{item.firstName + " " + item.lastName}
						</Text>
						{item.companies[loggedInCompany] === "Owner" && (
							<FontAwesome name="star" size={24} color="red" />
						)}
						{item.companies[loggedInCompany] === "Admin" && (
							<FontAwesome name="star" size={24} color="gold" />
						)}
					</View>
					{expandedIndex === index && (
						<View style={styles.expandedItem}>
							<Text style={styles.expandedText}>
								Email: {item.email}
							</Text>
						</View>
					)}
				</TouchableOpacity>
			</View>
		</LongPressGestureHandler>
	);

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<View style={styles.titleBar}>
				<TouchableOpacity
					containerStyle={{
						position: "absolute",
						left: 20,
						zIndex: 1,
					}}
					onPress={() => {
						navigation.goBack();
					}}
				>
					<Ionicons name="chevron-back" size={28} color="#000" />
				</TouchableOpacity>
				<Text style={styles.title}>Employees</Text>
			</View>
			<FlatList
				data={sortedEmployees}
				renderItem={renderItem}
				keyExtractor={(item) => item.id} // Use the id property instead of key
				ListEmptyComponent={<ActivityIndicator />}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
					/>
				}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		//marginTop: 20,
	},
	titleBar: {
		display: "flex",
		justifyContent: "center",
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#ccc",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		textAlign: "center",
	},
	item: {
		flexDirection: "row",
		justifyContent: "space-between",
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: "#ccc",
	},
	name: {
		fontSize: 18,
	},
	expandedItem: {
		padding: 10,
		backgroundColor: "#e0e0e0",
	},
	expandedText: {
		fontSize: 16,
		color: "#333",
	},
	modalBackground: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	modalView: {
		width: 300,
		backgroundColor: "white",
		borderRadius: 20,
		padding: 35,
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 5,
	},
	modalText: {
		marginBottom: 15,
		textAlign: "center",
	},
	buttonContainer: {
		flexDirection: "row",
		justifyContent: "space-around",
		padding: 10,
	},
});

export default EmployeeList;
