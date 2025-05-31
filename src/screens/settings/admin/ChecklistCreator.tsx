import React, { useState, useEffect, useRef } from "react"; // Add useRef import
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	TextInput,
	FlatList,
	Alert,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import db from "../../../constants/firestore";
import { useUser } from "../../../contexts/UserContext";

// Define types for our checklist data
type ChecklistItem = {
	id: string;
	text: string;
};

type Checklist = {
	id: string;
	title: string;
	items: ChecklistItem[];
	createdAt: number;
	updatedAt: number;
};

const ChecklistCreator = ({ navigation }) => {
	const { companyId } = useUser();

	// States for the component
	const [checklists, setChecklists] = useState<Checklist[]>([]);
	const [currentChecklist, setCurrentChecklist] = useState<Checklist | null>(
		null,
	);
	const [newItemText, setNewItemText] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	// Add ref for the TextInput
	const itemInputRef = useRef(null);

	// Fetch checklists on component mount
	useEffect(() => {
		fetchChecklists();
	}, [companyId]);

	// Fetch checklists from Firestore
	const fetchChecklists = async () => {
		if (!companyId) return;

		try {
			setLoading(true);

			const checklistsSnapshot = await db
				.collection("Companies")
				.doc(companyId)
				.collection("Checklists")
				.orderBy("updatedAt", "desc")
				.get();

			const fetchedChecklists = checklistsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as Checklist[];

			setChecklists(fetchedChecklists);
		} catch (error) {
			console.error("Error fetching checklists:", error);
			Alert.alert("Error", "Failed to load checklists");
		} finally {
			setLoading(false);
		}
	};

	// Create new empty checklist
	const createNewChecklist = () => {
		const newChecklist: Checklist = {
			id: "", // Will be assigned by Firestore
			title: "",
			items: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setCurrentChecklist(newChecklist);
		setIsEditing(true);
	};

	// Edit existing checklist
	const editChecklist = (checklist: Checklist) => {
		setCurrentChecklist(checklist);
		setIsEditing(true);
	};

	// Duplicate checklist
	const duplicateChecklist = (checklist: Checklist) => {
		const duplicatedChecklist: Checklist = {
			id: "", // Will be assigned by Firestore
			title: `${checklist.title} (Copy)`,
			items: [...checklist.items],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setCurrentChecklist(duplicatedChecklist);
		setIsEditing(true);
	};

	// Delete checklist with confirmation
	const confirmDeleteChecklist = (checklistId: string) => {
		Alert.alert(
			"Delete Checklist",
			"Are you sure you want to delete this checklist? This action cannot be undone.",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Delete",
					onPress: () => deleteChecklist(checklistId),
					style: "destructive",
				},
			],
		);
	};

	// Delete checklist from Firestore
	const deleteChecklist = async (checklistId: string) => {
		if (!companyId) return;

		try {
			setSaving(true);

			await db
				.collection("Companies")
				.doc(companyId)
				.collection("Checklists")
				.doc(checklistId)
				.delete();

			// Update local state
			setChecklists(
				checklists.filter((checklist) => checklist.id !== checklistId),
			);
			Alert.alert("Success", "Checklist deleted successfully");
		} catch (error) {
			console.error("Error deleting checklist:", error);
			Alert.alert("Error", "Failed to delete checklist");
		} finally {
			setSaving(false);
		}
	};

	// Add new item to current checklist
	const addChecklistItem = () => {
		if (!currentChecklist || !newItemText.trim()) return;

		const newItem: ChecklistItem = {
			id: Date.now().toString(), // Use timestamp as ID for simplicity
			text: newItemText.trim(),
		};

		setCurrentChecklist({
			...currentChecklist,
			items: [...currentChecklist.items, newItem],
			updatedAt: Date.now(),
		});

		setNewItemText("");

		// Focus back on the input after adding the item
		// Use setTimeout to ensure the clear happens first
		setTimeout(() => {
			if (itemInputRef.current) {
				itemInputRef.current.focus();
			}
		}, 0);
	};

	// Remove item from current checklist
	const removeChecklistItem = (itemId: string) => {
		if (!currentChecklist) return;

		setCurrentChecklist({
			...currentChecklist,
			items: currentChecklist.items.filter((item) => item.id !== itemId),
			updatedAt: Date.now(),
		});
	};

	// Save checklist to Firestore
	const saveChecklist = async () => {
		if (!currentChecklist || !companyId) return;

		// Validate fields
		if (!currentChecklist.title.trim()) {
			Alert.alert("Error", "Please enter a title for the checklist");
			return;
		}

		if (currentChecklist.items.length === 0) {
			Alert.alert(
				"Error",
				"Please add at least one item to the checklist",
			);
			return;
		}

		try {
			setSaving(true);

			const checklistData = {
				title: currentChecklist.title,
				items: currentChecklist.items,
				createdAt: currentChecklist.createdAt,
				updatedAt: Date.now(),
			};

			let checklistId = currentChecklist.id;

			if (checklistId) {
				// Update existing checklist
				await db
					.collection("Companies")
					.doc(companyId)
					.collection("Checklists")
					.doc(checklistId)
					.update(checklistData);
			} else {
				// Create new checklist
				const docRef = await db
					.collection("Companies")
					.doc(companyId)
					.collection("Checklists")
					.add(checklistData);

				checklistId = docRef.id;
			}

			// Refresh checklist list
			await fetchChecklists();

			Alert.alert("Success", "Checklist saved successfully");
			setIsEditing(false);
			setCurrentChecklist(null);
		} catch (error) {
			console.error("Error saving checklist:", error);
			Alert.alert("Error", "Failed to save checklist");
		} finally {
			setSaving(false);
		}
	};

	// Render an individual checklist item
	const renderChecklistItem = ({ item }: { item: ChecklistItem }) => (
		<View style={styles.itemContainer}>
			<Text style={styles.itemText} numberOfLines={2}>
				{item.text}
			</Text>
			<TouchableOpacity
				style={styles.removeButton}
				onPress={() => removeChecklistItem(item.id)}
			>
				<Icon name="remove-circle" size={24} color="#F44336" />
			</TouchableOpacity>
		</View>
	);

	// Render an existing checklist in the list
	const renderChecklist = ({ item }: { item: Checklist }) => (
		<View style={styles.checklistCard}>
			<View style={styles.checklistHeader}>
				<Text style={styles.checklistTitle}>{item.title}</Text>
				<Text style={styles.itemCount}>{item.items.length} items</Text>
			</View>

			<View style={styles.checklistActions}>
				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => editChecklist(item)}
				>
					<Icon name="edit" size={20} color="#2196F3" />
					<Text style={styles.actionText}>Edit</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => duplicateChecklist(item)}
				>
					<Icon name="content-copy" size={20} color="#4CAF50" />
					<Text style={styles.actionText}>Duplicate</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => confirmDeleteChecklist(item.id)}
				>
					<Icon name="delete" size={20} color="#F44336" />
					<Text style={styles.actionText}>Delete</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

	const insets = useSafeAreaInsets();

	// Main render function
	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			{/* Header */}
			<View style={styles.header}>
				<View style={styles.headerRow}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => {
							if (isEditing) {
								Alert.alert(
									"Discard Changes",
									"Are you sure you want to discard your changes?",
									[
										{
											text: "Cancel",
											style: "cancel",
										},
										{
											text: "Discard",
											onPress: () => {
												setIsEditing(false);
												setCurrentChecklist(null);
											},
										},
									],
								);
							} else {
								navigation.goBack();
							}
						}}
					>
						<Icon name="arrow-back" size={24} color="#333" />
					</TouchableOpacity>
					<View style={styles.headerTextContainer}>
						<Text style={styles.headerTitle}>
							{isEditing
								? currentChecklist?.id
									? "Edit Checklist"
									: "Create Checklist"
								: "Manage Checklists"}
						</Text>
						<Text style={styles.headerSubtitle}>
							{isEditing
								? "Add or remove checklist items"
								: "Create, edit or delete checklists"}
						</Text>
					</View>
				</View>
			</View>

			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#0000ff" />
					<Text style={styles.loadingText}>
						Loading checklists...
					</Text>
				</View>
			) : isEditing ? (
				// Checklist editor
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : "height"}
					style={{ flex: 1 }}
				>
					<ScrollView style={styles.editorContainer}>
						<View style={styles.formGroup}>
							<Text style={styles.label}>Checklist Title</Text>
							<TextInput
								style={styles.input}
								value={currentChecklist?.title || ""}
								onChangeText={(text) =>
									setCurrentChecklist({
										...currentChecklist!,
										title: text,
										updatedAt: Date.now(),
									})
								}
								placeholder="Enter checklist title"
							/>
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Checklist Items</Text>
							<View style={styles.itemInputContainer}>
								<TextInput
									ref={itemInputRef}
									style={styles.itemInput}
									value={newItemText}
									onChangeText={setNewItemText}
									placeholder="Add new item"
									onSubmitEditing={addChecklistItem}
									returnKeyType="done"
									blurOnSubmit={false} // Add this line to prevent blur on submit
								/>
								<TouchableOpacity
									style={styles.addButton}
									onPress={addChecklistItem}
									disabled={!newItemText.trim()}
								>
									<Icon
										name="add-circle"
										size={24}
										color={
											newItemText.trim()
												? "#4CAF50"
												: "#ccc"
										}
									/>
								</TouchableOpacity>
							</View>
						</View>

						<View style={styles.itemsList}>
							{currentChecklist?.items.length === 0 ? (
								<Text style={styles.emptyText}>
									No items added yet
								</Text>
							) : (
								currentChecklist?.items.map((item) => (
									<View
										key={item.id}
										style={styles.itemContainer}
									>
										<Text style={styles.itemText}>
											{item.text}
										</Text>
										<TouchableOpacity
											style={styles.removeButton}
											onPress={() =>
												removeChecklistItem(item.id)
											}
										>
											<Icon
												name="remove-circle"
												size={24}
												color="#F44336"
											/>
										</TouchableOpacity>
									</View>
								))
							)}
						</View>
					</ScrollView>

					<View style={styles.editorFooter}>
						<TouchableOpacity
							style={styles.cancelButton}
							onPress={() => {
								Alert.alert(
									"Discard Changes",
									"Are you sure you want to discard your changes?",
									[
										{
											text: "Cancel",
											style: "cancel",
										},
										{
											text: "Discard",
											onPress: () => {
												setIsEditing(false);
												setCurrentChecklist(null);
											},
										},
									],
								);
							}}
						>
							<Text style={styles.cancelButtonText}>Cancel</Text>
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.saveButton}
							onPress={saveChecklist}
							disabled={saving}
						>
							{saving ? (
								<ActivityIndicator
									size="small"
									color="#ffffff"
								/>
							) : (
								<Text style={styles.saveButtonText}>
									Save Checklist
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</KeyboardAvoidingView>
			) : (
				// Checklists list view
				<>
					<View style={styles.listContainer}>
						{checklists.length === 0 ? (
							<View style={styles.emptyContainer}>
								<Icon name="checklist" size={64} color="#ccc" />
								<Text style={styles.emptyText}>
									No checklists found
								</Text>
								<Text style={styles.emptySubtext}>
									Create a new checklist to get started
								</Text>
							</View>
						) : (
							<FlatList
								data={checklists}
								renderItem={renderChecklist}
								keyExtractor={(item) => item.id}
								contentContainerStyle={styles.listContent}
							/>
						)}
					</View>

					<View style={styles.footer}>
						<TouchableOpacity
							style={styles.createButton}
							onPress={createNewChecklist}
						>
							<Icon name="add" size={24} color="#fff" />
							<Text style={styles.createButtonText}>
								Create New Checklist
							</Text>
						</TouchableOpacity>
					</View>
				</>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f5f5f5",
	},
	header: {
		padding: 15,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#e0e0e0",
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
	},
	backButton: {
		padding: 5,
		marginRight: 10,
	},
	headerTextContainer: {
		flex: 1,
	},
	headerTitle: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333",
	},
	headerSubtitle: {
		fontSize: 16,
		color: "#666",
		marginTop: 5,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: "#666",
	},
	listContainer: {
		flex: 1,
	},
	listContent: {
		padding: 15,
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingBottom: 100,
	},
	emptyText: {
		fontSize: 18,
		color: "#666",
		marginTop: 10,
	},
	emptySubtext: {
		fontSize: 14,
		color: "#999",
		marginTop: 5,
		textAlign: "center",
	},
	checklistCard: {
		backgroundColor: "#fff",
		borderRadius: 8,
		padding: 15,
		marginBottom: 15,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	checklistHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 10,
	},
	checklistTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#333",
		flex: 1,
	},
	itemCount: {
		fontSize: 14,
		color: "#666",
		backgroundColor: "#f0f0f0",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	checklistActions: {
		flexDirection: "row",
		borderTopWidth: 1,
		borderTopColor: "#f0f0f0",
		paddingTop: 10,
		marginTop: 5,
	},
	actionButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		padding: 8,
	},
	actionText: {
		marginLeft: 5,
		fontSize: 14,
		color: "#333",
	},
	footer: {
		padding: 15,
		backgroundColor: "#fff",
		borderTopWidth: 1,
		borderTopColor: "#e0e0e0",
	},
	editorFooter: {
		padding: 15,
		backgroundColor: "#fff",
		borderTopWidth: 1,
		borderTopColor: "#e0e0e0",
		flexDirection: "row", // Added to ensure buttons align horizontally
	},
	createButton: {
		backgroundColor: "#4CAF50",
		borderRadius: 8,
		padding: 15,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	createButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
		marginLeft: 8,
	},
	editorContainer: {
		flex: 1,
		padding: 15,
	},
	formGroup: {
		marginBottom: 20,
	},
	label: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#333",
		marginBottom: 8,
	},
	input: {
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
	},
	itemInputContainer: {
		flexDirection: "row",
		alignItems: "center",
	},
	itemInput: {
		flex: 1,
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
	},
	addButton: {
		padding: 8,
		marginLeft: 8,
	},
	itemsList: {
		marginTop: 10,
		marginBottom: 20,
	},
	itemContainer: {
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		marginBottom: 10,
		flexDirection: "row",
		alignItems: "center",
	},
	itemText: {
		flex: 1,
		fontSize: 16,
		color: "#333",
	},
	removeButton: {
		padding: 5,
	},
	saveButton: {
		flex: 2,
		backgroundColor: "#2196F3",
		borderRadius: 8,
		padding: 15,
		alignItems: "center",
		justifyContent: "center",
	},
	saveButtonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
	},
	cancelButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 15,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 10,
		backgroundColor: "#f5f5f5", // Added for better visibility
	},
	cancelButtonText: {
		color: "#333", // Darkened for better contrast
		fontSize: 16,
		fontWeight: "500", // Added for better visibility
	},
});

export default ChecklistCreator;
