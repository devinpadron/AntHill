import React, { useEffect, useState } from "react";
import {
	SafeAreaView,
	View,
	Text,
	FlatList,
	StyleSheet,
	TouchableOpacity,
	LayoutAnimation,
	UIManager,
	Platform,
	Alert,
} from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { LongPressGestureHandler, State } from "react-native-gesture-handler";
import { getUserData } from "../../controllers/auth/authController";
import { getAllUsersInCompany } from "../../controllers/data/companyController";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EmployeeList = () => {
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
	const [company, setCompany] = useState("");
	const [user, setUser] = useState(null);

	useEffect(() => {
		const fetchData = async () => {
			const userData = await getUserData();
			if (userData) {
				setUser(userData);
				setCompany(userData.selectedCompany);
			}
		};
		fetchData();
	}, []);

	useEffect(() => {
		const fetchEmployees = async () => {
			if (company) {
				const employeeData = await getAllUsersInCompany(company);
				setEmployees(employeeData);
			}
		};
		fetchEmployees();
	}, [company]);

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
		if (employee.privilege != "Owner" && user.privilege === "Owner") {
			Alert.alert(
				employee.data.firstName + " " + employee.data.lastName,
				"What would you like to do?",
				[
					employee.privilege === "Admin"
						? {
								text: "Demote",
								onPress: () => {
									console.log(
										"Demoted",
										employee.data.firstName +
											employee.data.lastName
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
				<Text style={styles.title}>Employees</Text>
			</View>
			<FlatList
				data={sortedEmployees}
				renderItem={renderItem}
				keyExtractor={(item) => item.lastName}
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
		padding: 10,
		backgroundColor: "#f8f8f8",
		borderBottomWidth: 1,
		borderBottomColor: "#ccc",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
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
