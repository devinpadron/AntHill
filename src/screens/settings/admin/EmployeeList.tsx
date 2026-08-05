import React, { useCallback, useMemo, useState } from "react";
import {
	View,
	Text,
	FlatList,
	LayoutAnimation,
	UIManager,
	Platform,
	RefreshControl,
	ActivityIndicator,
	StatusBar,
	TouchableOpacity,
	Modal,
	ScrollView,
	Switch,
	Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../contexts/UserContext";
import { useCompanyMembers } from "../../../hooks/useCompanyMembers";
import { useGroups } from "../../../hooks/useGroups";
import {
	setMemberGroups,
	setMemberVisibility,
} from "../../../services/groupService";
import { showMemberActions } from "../../../utils/memberActions";
import { styles } from "./EmployeeList.styles";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EmployeeList = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const { user, role: userPrivilege, companyId, isAdmin } = useUser();
	const { groups, namesFor: groupNamesFor } = useGroups(companyId ?? "");
	/*
	 * One query. v1's useEmployeeData subscribed to the membership list and
	 * then fanned out a profile read per member on every snapshot; the names
	 * live on the membership records now.
	 */
	const { members, isLoading: refreshing } = useCompanyMembers(
		companyId ?? "",
	);

	// Already sorted by role then name inside the hook.
	const employees = useMemo(
		() =>
			members.map((m) => ({
				id: m.userId,
				firstName: m.firstName,
				lastName: m.lastName,
				email: m.email,
				phone: m.phone ?? "",
				role: m.role,
				// Defaulted for memberships written before segmentation
				// existed; the migration backfills both explicitly.
				visibility: m.visibility ?? "open",
				groupIds: m.groupIds ?? [],
			})),
		[members],
	);

	// Live subscription — nothing to refetch.
	const refetchEmployees = useCallback(() => {}, []);
	const [expandedIndex, setExpandedIndex] = useState(null);
	const [accessFor, setAccessFor] = useState<any>(null);

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
			showMemberActions(
				employee,
				userPrivilege,
				companyId,
				refetchEmployees,
			);
		},
		[userPrivilege, companyId, refetchEmployees],
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

							<View style={styles.detailRow}>
								<Ionicons
									name={
										item.visibility === "restricted"
											? "lock-closed-outline"
											: "earth-outline"
									}
									size={16}
									color="#666"
									style={styles.detailIcon}
								/>
								<Text style={styles.detailText}>
									{item.visibility === "restricted"
										? item.groupIds.length
											? `Invited jobs only · ${groupNamesFor(item.groupIds).join(", ")}`
											: "Invited jobs only · no groups yet"
										: "Sees all open jobs"}
								</Text>
							</View>

							{isAdmin && (
								<TouchableOpacity
									style={styles.accessButton}
									onPress={() => setAccessFor(item)}
								>
									<Ionicons
										name="options-outline"
										size={16}
										color="#2078c8"
									/>
									<Text style={styles.accessButtonText}>
										Job access
									</Text>
								</TouchableOpacity>
							)}

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
		[expandedIndex, handlePress, handleLongPress, isAdmin, groupNamesFor],
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

			<JobAccessModal
				member={accessFor}
				groups={groups}
				companyId={companyId ?? ""}
				onClose={() => setAccessFor(null)}
			/>
		</View>
	);
};

/**
 * Sets what jobs a worker can see.
 *
 * Two independent things, which is why they are one sheet: whether the worker
 * sees every open job or only what they are invited to, and which groups they
 * belong to. A restricted worker in no groups will never be shown anything —
 * that is a real configuration and the copy says so rather than preventing it,
 * because it is also how you park someone without removing them.
 */
const JobAccessModal = ({ member, groups, companyId, onClose }) => {
	const [visibility, setVisibility] = useState("open");
	const [groupIds, setGroupIds] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);

	// Seed from the member each time the sheet opens for a different person.
	React.useEffect(() => {
		if (!member) return;
		setVisibility(member.visibility ?? "open");
		setGroupIds(member.groupIds ?? []);
	}, [member?.id]);

	if (!member) return null;

	const toggleGroup = (groupId: string) =>
		setGroupIds((prev) =>
			prev.includes(groupId)
				? prev.filter((g) => g !== groupId)
				: [...prev, groupId],
		);

	const save = async () => {
		setSaving(true);
		try {
			await Promise.all([
				setMemberVisibility(companyId, member.id, visibility as any),
				setMemberGroups(companyId, member.id, groupIds),
			]);
			onClose();
		} catch {
			Alert.alert(
				"Could not save",
				"That change did not go through. Check your connection and try again.",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			visible
			animationType="slide"
			transparent
			onRequestClose={onClose}
		>
			<View style={styles.modalBackdrop}>
				<View style={styles.modalSheet}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>
							{member.firstName} {member.lastName}
						</Text>
						<TouchableOpacity onPress={onClose}>
							<Ionicons name="close" size={24} color="#333" />
						</TouchableOpacity>
					</View>

					<ScrollView style={{ maxHeight: 420 }}>
						<View style={styles.modalRow}>
							<View style={{ flex: 1, paddingRight: 12 }}>
								<Text style={styles.modalRowTitle}>
									Invited jobs only
								</Text>
								<Text style={styles.modalRowHint}>
									For contractors. They stop seeing open jobs
									and only get what you send to their groups.
								</Text>
							</View>
							<Switch
								value={visibility === "restricted"}
								onValueChange={(on) =>
									setVisibility(on ? "restricted" : "open")
								}
							/>
						</View>

						<Text style={styles.modalSectionTitle}>Groups</Text>
						{groups.length === 0 ? (
							<Text style={styles.modalEmpty}>
								No groups yet. Create one under Worker groups.
							</Text>
						) : (
							groups.map((group) => {
								const on = groupIds.includes(group.id);
								return (
									<TouchableOpacity
										key={group.id}
										style={styles.modalCheckRow}
										onPress={() => toggleGroup(group.id)}
									>
										<Ionicons
											name={
												on
													? "checkbox"
													: "square-outline"
											}
											size={22}
											color={on ? "#2078c8" : "#999"}
										/>
										<Text style={styles.modalCheckLabel}>
											{group.name}
										</Text>
									</TouchableOpacity>
								);
							})
						)}

						{visibility === "restricted" &&
							groupIds.length === 0 && (
								<Text style={styles.modalWarning}>
									This worker is in no groups, so they will
									not see any jobs until you add them to one
									or invite them directly.
								</Text>
							)}
					</ScrollView>

					<TouchableOpacity
						style={[styles.modalSave, saving && { opacity: 0.6 }]}
						onPress={save}
						disabled={saving}
					>
						<Text style={styles.modalSaveText}>
							{saving ? "Saving…" : "Save"}
						</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
};

export default EmployeeList;
