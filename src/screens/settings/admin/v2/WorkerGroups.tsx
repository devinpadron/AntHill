import React, { useMemo, useState } from "react";
import {
	View,
	Text,
	FlatList,
	StyleSheet,
	StatusBar,
	TouchableOpacity,
	TextInput,
	Alert,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../../contexts/v2/UserContext";
import { useGroups } from "../../../../hooks/v2/useGroups";
import { useCompanyMembers } from "../../../../hooks/v2/useCompanyMembers";
import {
	clearGroupJoinCode,
	createGroup,
	deleteGroup,
	renameGroup,
	setGroupJoinCode,
} from "../../../../services/v2/groupService";

/*
 * Worker groups.
 *
 * A group is a named set of workers a manager can publish an event to. It
 * exists so a 1099 contractor is shown only the jobs meant for them instead of
 * every unassigned event on the books.
 *
 * Membership is edited from the employee list (Job access), not here, because
 * it is stored on the membership document. This screen owns the groups
 * themselves and shows the resulting headcount, which is the number a manager
 * actually needs before publishing to one.
 */

const WorkerGroups = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const { companyId } = useUser();
	const { groups, isLoading } = useGroups(companyId ?? "");
	const { members } = useCompanyMembers(companyId ?? "");

	const [newName, setNewName] = useState("");
	const [busy, setBusy] = useState(false);

	/** Headcount per group, derived from the member list already in memory. */
	const counts = useMemo(() => {
		const out: Record<string, number> = {};
		for (const member of members) {
			for (const groupId of member.groupIds ?? []) {
				out[groupId] = (out[groupId] ?? 0) + 1;
			}
		}
		return out;
	}, [members]);

	const add = async () => {
		const name = newName.trim();
		if (!name) return;

		if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
			Alert.alert(
				"Already exists",
				`There is already a group called "${name}".`,
			);
			return;
		}

		setBusy(true);
		try {
			await createGroup(companyId ?? "", name);
			setNewName("");
		} catch {
			Alert.alert("Could not create group", "Please try again.");
		} finally {
			setBusy(false);
		}
	};

	const rename = (group) => {
		Alert.prompt?.(
			"Rename group",
			null,
			async (value) => {
				const name = (value ?? "").trim();
				if (!name || name === group.name) return;
				try {
					await renameGroup(group.id, name);
				} catch {
					Alert.alert("Could not rename group", "Please try again.");
				}
			},
			"plain-text",
			group.name,
		);
	};

	/*
	 * Issues or rotates the group's join code.
	 *
	 * Rotating is destructive on purpose — the old code stops working the
	 * moment the new one exists, which is the only reason to rotate.
	 */
	const issueCode = (group, visibility) => {
		const go = async () => {
			try {
				await setGroupJoinCode(
					companyId ?? "",
					group.id,
					visibility,
					group.joinCode,
				);
			} catch {
				Alert.alert("Could not create code", "Please try again.");
			}
		};

		if (!group.joinCode) return go();

		Alert.alert(
			"Replace this code?",
			`Anyone still holding ${group.joinCode} will no longer be able to join. People already in the group are unaffected.`,
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Replace", style: "destructive", onPress: go },
			],
		);
	};

	const revokeCode = (group) => {
		Alert.alert(
			"Turn off the join code?",
			`${group.joinCode} will stop working. People already in the group stay in it.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Turn off",
					style: "destructive",
					onPress: async () => {
						try {
							await clearGroupJoinCode(group.id, group.joinCode);
						} catch {
							Alert.alert(
								"Could not remove code",
								"Please try again.",
							);
						}
					},
				},
			],
		);
	};

	/*
	 * What the two kinds of code actually do.
	 *
	 * "Open" and "Restricted" are not self-explanatory next to each other, and
	 * the buttons do not otherwise say they MINT a code rather than toggle a
	 * setting — so the explanation sits one tap away instead of being folded
	 * into a label that would have to be too long to fit.
	 */
	const explainCodes = () =>
		Alert.alert(
			"Join codes",
			"A join code puts whoever signs up with it straight into this group.\n\n" +
				"Open — they join the group and still see every unassigned job that wasn't sent to a specific group, like any other employee.\n\n" +
				"Restricted — they only see jobs sent to their group, or to them by name. Nothing else in the company appears for them. This is the one for 1099 contractors.\n\n" +
				"You can change any individual's access later from the employee list.",
		);

	const remove = (group) => {
		const count = counts[group.id] ?? 0;
		Alert.alert(
			`Delete "${group.name}"?`,
			count
				? `${count} ${count === 1 ? "worker is" : "workers are"} in this group. They stay in the company and keep any jobs they have already been invited to — they just stop receiving new ones sent to this group.`
				: "Nobody is in this group.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							await deleteGroup(
								companyId ?? "",
								group.id,
								group.joinCode,
							);
						} catch {
							Alert.alert(
								"Could not delete group",
								"Please try again.",
							);
						}
					},
				},
			],
		);
	};

	const renderItem = ({ item }) => {
		const count = counts[item.id] ?? 0;
		return (
			<View style={styles.card}>
				<View style={styles.row}>
					<View style={styles.rowMain}>
						<Text style={styles.rowName}>{item.name}</Text>
						<Text style={styles.rowMeta}>
							{count === 0
								? "No workers yet"
								: `${count} ${count === 1 ? "worker" : "workers"}`}
						</Text>
					</View>
					<TouchableOpacity
						style={styles.rowAction}
						onPress={() => rename(item)}
						accessibilityLabel={`Rename ${item.name}`}
					>
						<Ionicons
							name="pencil-outline"
							size={18}
							color="#2078c8"
						/>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.rowAction}
						onPress={() => remove(item)}
						accessibilityLabel={`Delete ${item.name}`}
					>
						<Ionicons
							name="trash-outline"
							size={18}
							color="#d83030"
						/>
					</TouchableOpacity>
				</View>

				{/*
				 * The join code. Someone who signs up with it lands in this
				 * group already, so a contractor is restricted from their
				 * first launch instead of depending on someone remembering to
				 * set it afterwards.
				 */}
				{item.joinCode ? (
					<View style={styles.codePanel}>
						<View style={{ flex: 1 }}>
							<Text style={styles.codeValue}>
								{item.joinCode}
							</Text>
							<Text style={styles.codeMeta}>
								Joins this group ·{" "}
								{item.joinVisibility === "restricted"
									? "invited jobs only"
									: "sees all open jobs"}
							</Text>
						</View>
						<TouchableOpacity
							style={styles.codeInfo}
							onPress={explainCodes}
							accessibilityLabel="What join codes do"
						>
							<Ionicons
								name="information-circle-outline"
								size={18}
								color="#8a8aa0"
							/>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.codeAction}
							onPress={() =>
								issueCode(item, item.joinVisibility ?? "open")
							}
						>
							<Text style={styles.codeActionText}>New code</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.codeAction}
							onPress={() => revokeCode(item)}
						>
							<Text
								style={[
									styles.codeActionText,
									{ color: "#d83030" },
								]}
							>
								Off
							</Text>
						</TouchableOpacity>
					</View>
				) : (
					<View style={styles.codePanel}>
						<Text style={styles.codeHint}>
							No join code. Create one so new hires land straight
							in this group.
						</Text>
						<TouchableOpacity
							style={styles.codeInfo}
							onPress={explainCodes}
							accessibilityLabel="What join codes do"
						>
							<Ionicons
								name="information-circle-outline"
								size={18}
								color="#8a8aa0"
							/>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.codeAction}
							onPress={() => issueCode(item, "open")}
						>
							<Text style={styles.codeActionText}>Open</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.codeAction}
							onPress={() => issueCode(item, "restricted")}
						>
							<Text style={styles.codeActionText}>
								Restricted
							</Text>
						</TouchableOpacity>
					</View>
				)}
			</View>
		);
	};

	return (
		<KeyboardAvoidingView
			style={{ flex: 1 }}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<View
				style={[{ flex: 1, paddingTop: insets.top }, styles.container]}
			>
				<StatusBar barStyle="dark-content" />

				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						<Ionicons name="arrow-back" size={24} color="#333" />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Worker groups</Text>
					<View style={{ width: 40 }} />
				</View>

				<Text style={styles.blurb}>
					Publish a job to a group and only those workers are asked
					about it. Add workers to a group from the employee list.
				</Text>

				<View style={styles.addRow}>
					<TextInput
						style={styles.input}
						value={newName}
						onChangeText={setNewName}
						placeholder="New group name"
						placeholderTextColor="#aaa"
						returnKeyType="done"
						onSubmitEditing={add}
					/>
					<TouchableOpacity
						style={[
							styles.addButton,
							(!newName.trim() || busy) && { opacity: 0.5 },
						]}
						onPress={add}
						disabled={!newName.trim() || busy}
					>
						<Ionicons name="add" size={22} color="#fff" />
					</TouchableOpacity>
				</View>

				<FlatList
					data={groups}
					renderItem={renderItem}
					keyExtractor={(item) => item.id}
					contentContainerStyle={styles.listContent}
					ListEmptyComponent={
						<View style={styles.empty}>
							{isLoading ? (
								<ActivityIndicator
									size="large"
									color="#2089dc"
								/>
							) : (
								<>
									<Ionicons
										name="people-outline"
										size={56}
										color="#ccc"
									/>
									<Text style={styles.emptyText}>
										No groups yet
									</Text>
									<Text style={styles.emptyHint}>
										Without groups, every worker who can see
										open jobs sees all of them — which is
										how it has always worked.
									</Text>
								</>
							)}
						</View>
					}
				/>
			</View>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f8f9fa" },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: "#fff",
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#e5e5e5",
	},
	backButton: { width: 40 },
	headerTitle: { fontSize: 17, fontWeight: "700", color: "#222" },
	blurb: {
		fontSize: 13,
		color: "#777",
		lineHeight: 19,
		paddingHorizontal: 16,
		paddingTop: 14,
	},
	addRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	input: {
		flex: 1,
		backgroundColor: "#fff",
		borderRadius: 10,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 15,
		color: "#222",
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: "#ddd",
	},
	addButton: {
		width: 44,
		height: 44,
		borderRadius: 10,
		backgroundColor: "#2078c8",
		alignItems: "center",
		justifyContent: "center",
		marginLeft: 10,
	},
	listContent: { paddingHorizontal: 16, paddingBottom: 32 },
	card: {
		backgroundColor: "#fff",
		borderRadius: 10,
		marginBottom: 10,
		overflow: "hidden",
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
	},
	codePanel: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f6f7fb",
		paddingHorizontal: 14,
		paddingVertical: 10,
	},
	codeValue: {
		fontSize: 17,
		fontWeight: "700",
		color: "#2b2b45",
		letterSpacing: 2,
	},
	codeMeta: { fontSize: 11, color: "#888", marginTop: 2 },
	codeHint: { flex: 1, fontSize: 12, color: "#888", paddingRight: 8 },
	codeAction: { paddingHorizontal: 8, paddingVertical: 6 },
	codeInfo: { paddingHorizontal: 4, paddingVertical: 6 },
	codeActionText: { fontSize: 12, fontWeight: "700", color: "#2078c8" },
	rowMain: { flex: 1, paddingRight: 8 },
	rowName: { fontSize: 16, fontWeight: "600", color: "#222" },
	rowMeta: { fontSize: 13, color: "#888", marginTop: 2 },
	rowAction: { padding: 8, marginLeft: 4 },
	empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 24 },
	emptyText: {
		fontSize: 16,
		fontWeight: "600",
		color: "#999",
		marginTop: 12,
	},
	emptyHint: {
		fontSize: 13,
		color: "#aaa",
		textAlign: "center",
		marginTop: 6,
		lineHeight: 19,
	},
});

export default WorkerGroups;
