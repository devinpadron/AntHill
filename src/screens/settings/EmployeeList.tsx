import React, { useState, useCallback } from "react";
import {
	View,
	Text,
	FlatList,
	StyleSheet,
	LayoutAnimation,
	UIManager,
	Platform,
	RefreshControl,
	ActivityIndicator,
} from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../contexts/UserContext";
import { useEmployeeData } from "../../hooks/useEmployeeData";
import { EmployeeItem } from "../../components/employeeList/EmployeeItem";
import { handleEmployeeAction } from "../../utils/employeeUtils";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EmployeeList = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const { user, userPrivilege } = useUser();
	const { employees, refreshing, refetchEmployees, companyId } =
		useEmployeeData();
	const [expandedIndex, setExpandedIndex] = useState(null);

	// Toggle expanded item
	const handlePress = useCallback(
		(index) => {
			LayoutAnimation.configureNext(
				LayoutAnimation.Presets.easeInEaseOut,
			);
			setExpandedIndex(expandedIndex === index ? null : index);
		},
		[expandedIndex],
	);

	// Handle long-press actions
	const handleLongPress = useCallback(
		(employee) => {
			handleEmployeeAction(
				employee,
				userPrivilege,
				companyId,
				refetchEmployees,
			);
		},
		[user, companyId, refetchEmployees],
	);

	const renderItem = useCallback(
		({ item, index }) => (
			<EmployeeItem
				employee={item}
				index={index}
				expandedIndex={expandedIndex}
				companyId={companyId}
				onPress={handlePress}
				onLongPress={handleLongPress}
			/>
		),
		[expandedIndex, companyId, handlePress, handleLongPress],
	);

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<View style={styles.titleBar}>
				<TouchableOpacity
					containerStyle={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons name="chevron-back" size={28} color="#000" />
				</TouchableOpacity>
				<Text style={styles.title}>Employees</Text>
			</View>

			<FlatList
				data={employees}
				renderItem={renderItem}
				keyExtractor={(item) => item.id}
				ListEmptyComponent={<ActivityIndicator />}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={refetchEmployees}
					/>
				}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
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
	backButton: {
		position: "absolute",
		left: 20,
		zIndex: 1,
	},
});

export default EmployeeList;
