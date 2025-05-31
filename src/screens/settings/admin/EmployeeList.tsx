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
	StatusBar,
	TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../contexts/UserContext";
import { useEmployeeData } from "../../../hooks/useEmployeeData";
import { handleEmployeeAction } from "../../../utils/employeeUtils";

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

	// Render individual employee item
	const renderItem = useCallback(
		({ item, index }) => {
			const isExpanded = expandedIndex === index;
			const privilegeColor = getPrivilegeColor(item.role);

			return (
				<TouchableOpacity
					style={[
						styles.employeeCard,
						isExpanded && styles.employeeCardExpanded,
					]}
					onPress={() => handlePress(index)}
					onLongPress={() => handleLongPress(item)}
					activeOpacity={0.7}
				>
					<View style={styles.employeeHeader}>
						<View style={styles.employeeMainInfo}>
							<View style={[styles.employeeAvatarContainer]}>
								<Text style={styles.avatarText}>
									{item.firstName && item.firstName.charAt(0)}
									{item.lastName && item.lastName.charAt(0)}
								</Text>
							</View>

							<View style={styles.employeeInfo}>
								<Text style={styles.employeeName}>
									{item.firstName} {item.lastName}
								</Text>
							</View>
						</View>

						<View style={styles.headerRight}>
							{/* Privilege badge */}
							<View
								style={[
									styles.privilegeBadge,
									{ backgroundColor: privilegeColor.bg },
								]}
							>
								<Text
									style={[
										styles.privilegeText,
										{ color: privilegeColor.text },
									]}
								>
									{getPrivilegeLabel(item.role)}
								</Text>
							</View>

							<Ionicons
								name={
									isExpanded ? "chevron-up" : "chevron-down"
								}
								size={18}
								color="#999"
								style={{ marginLeft: 8 }}
							/>
						</View>
					</View>

					{isExpanded && (
						<View style={styles.expandedContent}>
							<View style={styles.detailRow}>
								<Ionicons
									name="mail-outline"
									size={16}
									color="#666"
									style={styles.detailIcon}
								/>
								<Text style={styles.detailText}>
									{item.email || "No email provided"}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Ionicons
									name="call-outline"
									size={16}
									color="#666"
									style={styles.detailIcon}
								/>
								<Text style={styles.detailText}>
									{item.phone || "No phone provided"}
								</Text>
							</View>

							<View style={styles.detailRow}>
								<Ionicons
									name="person-outline"
									size={16}
									color="#666"
									style={styles.detailIcon}
								/>
								<Text style={styles.detailText}>
									ID: {item.id}
								</Text>
							</View>

							{item.notes && (
								<View style={styles.notesContainer}>
									<Text style={styles.notesText}>
										{item.notes}
									</Text>
								</View>
							)}
						</View>
					)}
				</TouchableOpacity>
			);
		},
		[expandedIndex, handlePress, handleLongPress],
	);

	// Helper function to determine privilege display
	const getPrivilegeColor = (privilege) => {
		switch (privilege) {
			case "owner":
				return { bg: "#ffe0e0", text: "#d83030" };
			case "manager":
				return { bg: "#e0f0ff", text: "#2078c8" };
			case "user":
			default:
				return { bg: "#e6f7e6", text: "#4CAF50" };
		}
	};

	// Helper function to get readable privilege label
	const getPrivilegeLabel = (privilege) => {
		switch (privilege) {
			case "owner":
				return "Owner";
			case "manager":
				return "Manager";
			case "user":
				return "user";
			default:
				return privilege
					? privilege.charAt(0).toUpperCase() + privilege.slice(1)
					: "User";
		}
	};

	return (
		<View style={[{ flex: 1, paddingTop: insets.top }, styles.container]}>
			<StatusBar barStyle="dark-content" />

			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons name="arrow-back" size={24} color="#333" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Employees</Text>
				<View style={{ width: 40 }} />
			</View>

			<View style={styles.subHeader}>
				<View style={styles.statsContainer}>
					<View style={styles.statItem}>
						<Text style={styles.statValue}>{employees.length}</Text>
						<Text style={styles.statLabel}>Total</Text>
					</View>
				</View>
			</View>

			<FlatList
				data={employees}
				renderItem={renderItem}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.listContent}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						{refreshing ? (
							<ActivityIndicator size="large" color="#2089dc" />
						) : (
							<>
								<Ionicons
									name="people"
									size={64}
									color="#ccc"
								/>
								<Text style={styles.emptyText}>
									No employees found
								</Text>
							</>
						)}
					</View>
				}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={refetchEmployees}
						colors={["#2089dc"]}
						tintColor="#2089dc"
					/>
				}
			/>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		textAlign: "center",
		flex: 1,
	},
	backButton: {
		padding: 8,
	},
	subHeader: {
		backgroundColor: "white",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
	},
	statsContainer: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
	},
	statItem: {
		alignItems: "center",
		paddingHorizontal: 24,
	},
	statValue: {
		fontSize: 22,
		fontWeight: "700",
		color: "#2089dc",
	},
	statLabel: {
		fontSize: 14,
		color: "#666",
		marginTop: 4,
	},
	statDivider: {
		height: 30,
		width: 1,
		backgroundColor: "#e0e0e0",
	},
	listContent: {
		padding: 16,
		paddingBottom: 24,
	},
	employeeCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 12,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	employeeCardExpanded: {
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 4,
		elevation: 4,
	},
	employeeHeader: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
	},
	employeeMainInfo: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
	},
	employeeAvatarContainer: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: "#e6f2ff",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 16,
	},
	inactiveAvatar: {
		backgroundColor: "#f0f0f0",
	},
	avatarText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#2089dc",
	},
	employeeInfo: {
		flex: 1,
	},
	employeeName: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	employeeRole: {
		fontSize: 14,
		color: "#666",
		marginTop: 2,
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
	},
	privilegeBadge: {
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	privilegeText: {
		fontSize: 12,
		fontWeight: "500",
	},
	expandedContent: {
		padding: 16,
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
	},
	detailRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 12,
	},
	detailIcon: {
		marginRight: 12,
		width: 22,
	},
	detailText: {
		fontSize: 15,
		color: "#444",
		flex: 1,
	},
	notesContainer: {
		backgroundColor: "#f9f9f9",
		padding: 12,
		borderRadius: 8,
		marginTop: 8,
	},
	notesTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: "#555",
		marginBottom: 4,
	},
	notesText: {
		fontSize: 14,
		color: "#666",
		lineHeight: 20,
	},
	emptyContainer: {
		alignItems: "center",
		justifyContent: "center",
		padding: 40,
	},
	emptyText: {
		fontSize: 16,
		color: "#888",
		marginTop: 12,
	},
});

export default EmployeeList;
