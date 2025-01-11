import React, { useEffect, useState } from "react";
import {
	SafeAreaView,
	View,
	Text,
	FlatList,
	StyleSheet,
	LayoutAnimation,
	UIManager,
	Platform,
	Alert,
	ActivityIndicator,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { LongPressGestureHandler, State } from "react-native-gesture-handler";
import {
	getUser,
	subscribeCurrentUser,
} from "../../controllers/userController";
import { subscribeAllUsersInCompany } from "../../controllers/companyController";

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
				privilege: string;
				firstName: string;
				lastName: string;
				email: string;
			}
		>
	>({});
	const [user, setUser] = useState(null);

	useEffect(() => {
		if (!user) return;
		const subscriber = subscribeAllUsersInCompany(
			user.loggedInCompany,
			async (snapshot) => {
				const employeeData = {};
				for (const doc of snapshot.docs) {
					const data = await getUser(doc.id);
					const privilege = data.companies[user.loggedInCompany];
					const employeeJson = {
						privilege: privilege,
						...data,
					};
					employeeData[doc.id] = employeeJson;
				}
				setEmployees(employeeData);
			}
		);
		return () => subscriber();
	}, [employees, user]);

	useEffect(() => {
		const subscriber = subscribeCurrentUser((snapshot) => {
			const userData = snapshot.data();
			setUser(userData);
		});
		return () => subscriber();
	}, []);

	const sortedEmployees = Object.values(employees)
		.filter(
			(employee) => employee && employee.privilege && employee.firstName
		) // Filter out invalid entries
		.sort((a, b) => {
			const privilegeOrder = { Owner: 0, Admin: 1, User: 2 };
			if (privilegeOrder[a.privilege] !== privilegeOrder[b.privilege]) {
				return (
					privilegeOrder[a.privilege] - privilegeOrder[b.privilege]
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
		// TODO add functionality to demote/promote/delete
		if (employee.privilege != "Owner" && user.privilege === "Owner") {
			Alert.alert(
				employee.firstName + " " + employee.lastName,
				"What would you like to do?",
				[
					employee.privilege === "Admin"
						? {
								text: "Demote",
								onPress: () => {
									console.log(
										"Demoted",
										employee.firstName + employee.lastName
									);
								},
						  }
						: {
								text: "Promote",
								onPress: () => {
									console.log(
										"Promoted",
										employee.firstName + employee.lastName
									);
								},
						  },
					{
						text: "Delete",
						style: "destructive",
						onPress: () => {
							console.log(
								"Delete",
								employee.firstName + employee.lastName
							);
						},
					},
					{
						text: "Cancel",
						style: "cancel",
					},
				]
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
						{item.privilege === "Owner" && (
							<FontAwesome name="star" size={24} color="red" />
						)}
						{item.privilege === "Admin" && (
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
		<SafeAreaView style={styles.container}>
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
				keyExtractor={(item) => item.lastName}
				ListEmptyComponent={<ActivityIndicator />}
			/>
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		marginTop: 20,
	},
	titleBar: {
		display: "flex",
		justifyContent: "center",
		padding: 10,
		backgroundColor: "#f8f8f8",
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
