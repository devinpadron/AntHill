import React, { useState, useEffect, useRef } from "react"; // Add useRef import
import {
	View,
	Text,
	TouchableOpacity,
	TextInput,
	FlatList,
	Alert,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useUser } from "../../../contexts/UserContext";

// Define types for our checklist data
/*
 * The screen used to declare its own Checklist with epoch-millis timestamps.
 * The shared v2 model uses Timestamps and the service stamps them, so local
 * createdAt/updatedAt bookkeeping is gone.
 */
import type { Checklist, ChecklistItem } from "../../../types";
import {
	deleteChecklist as removeChecklist,
	saveChecklist as writeChecklist,
	subscribeChecklists,
} from "../../../services/libraryService";
import { checklistStyles } from "./ChecklistCreator.styles";
import { useTheme, useThemedStyles } from "../../../theme";
import { SafeAreaBand } from "../../../components/ui";

/*
 * What the editor holds. A draft has no companyId, timestamps or schemaVersion
 * — those are the service's to set, and a half-built checklist should not be
 * typed as a persisted one.
 */
type ChecklistDraft = Pick<Checklist, "id" | "title" | "items">;

const ChecklistCreator = ({ navigation }) => {
	const theme = useTheme();
	const styles = useThemedStyles(checklistStyles);
	const { companyId } = useUser();

	// States for the component
	const [checklists, setChecklists] = useState<Checklist[]>([]);
	const [currentChecklist, setCurrentChecklist] =
		useState<ChecklistDraft | null>(null);
	const [newItemText, setNewItemText] = useState("");
	const [itemInputHeight, setItemInputHeight] = useState(44);
	const [titleInputHeight, setTitleInputHeight] = useState(44);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	// Add ref for the TextInput
	const itemInputRef = useRef(null);

	/*
	 * Live subscription. The screen used to re-fetch the whole list after every
	 * save and delete; the subscription keeps it current on its own, including
	 * when another admin edits on a different device.
	 */
	useEffect(() => {
		if (!companyId) {
			setLoading(false);
			return;
		}

		return subscribeChecklists(companyId, (next) => {
			setChecklists(next);
			setLoading(false);
		});
	}, [companyId]);

	// Create new empty checklist
	const createNewChecklist = () => {
		const newChecklist: ChecklistDraft = {
			id: "", // Will be assigned by Firestore
			title: "",
			items: [],
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
		const duplicatedChecklist: ChecklistDraft = {
			id: "", // Will be assigned by Firestore
			title: `${checklist.title} (Copy)`,
			items: [...checklist.items],
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

			await removeChecklist(checklistId);

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
			};

			let checklistId = currentChecklist.id;

			if (checklistId) {
				// Update existing checklist
				await writeChecklist(companyId, {
					...checklistData,
					id: checklistId,
				});
			} else {
				// Create new checklist
				checklistId = await writeChecklist(companyId, checklistData);
			}

			// Refresh checklist list
			// list refreshes via the subscription

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
			<Text style={styles.itemText}>{item.text}</Text>
			<TouchableOpacity
				style={styles.removeButton}
				onPress={() => removeChecklistItem(item.id)}
			>
				<Icon
					name="remove-circle"
					size={24}
					color={theme.colors.danger}
				/>
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
					<Icon name="edit" size={20} color={theme.colors.accent} />
					<Text style={styles.actionText}>Edit</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => duplicateChecklist(item)}
				>
					<Icon
						name="content-copy"
						size={20}
						color={theme.colors.success}
					/>
					<Text style={styles.actionText}>Duplicate</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => confirmDeleteChecklist(item.id)}
				>
					<Icon name="delete" size={20} color={theme.colors.danger} />
					<Text style={styles.actionText}>Delete</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

	// Main render function
	return (
		<View style={styles.container}>
			<SafeAreaBand />
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
						<Icon
							name="arrow-back"
							size={24}
							color={theme.colors.text}
						/>
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
					<ActivityIndicator
						size="large"
						color={theme.colors.accent}
					/>
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
					<ScrollView
						style={styles.editorContainer}
						keyboardShouldPersistTaps="handled"
					>
						<View style={styles.formGroup}>
							<Text style={styles.label}>Checklist Title</Text>
							<TextInput
								style={[
									styles.input,
									{ height: Math.max(44, titleInputHeight) },
								]}
								value={currentChecklist?.title || ""}
								onChangeText={(text) =>
									setCurrentChecklist({
										...currentChecklist!,
										title: text,
									})
								}
								placeholder="Enter checklist title"
								multiline
								textAlignVertical="top"
								onContentSizeChange={(e) => {
									const h =
										e.nativeEvent.contentSize?.height || 44;
									setTitleInputHeight(h + 12);
								}}
							/>
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Checklist Items</Text>
							<View style={styles.itemInputContainer}>
								<TextInput
									ref={itemInputRef}
									style={[
										styles.itemInput,
										{
											height: Math.max(
												44,
												itemInputHeight,
											),
										},
									]}
									value={newItemText}
									onChangeText={setNewItemText}
									placeholder="Add new item"
									onSubmitEditing={addChecklistItem}
									returnKeyType="done"
									blurOnSubmit={false} // Add this line to prevent blur on submit
									multiline
									onContentSizeChange={(e) => {
										const h =
											e.nativeEvent.contentSize?.height ||
											44;
										setItemInputHeight(h + 12);
									}}
									textAlignVertical="top"
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
												? theme.colors.success
												: theme.colors.borderStrong
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
												color={theme.colors.danger}
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
									color={theme.colors.onAccent}
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
								<Icon
									name="checklist"
									size={64}
									color={theme.colors.borderStrong}
								/>
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
							<Icon
								name="add"
								size={24}
								color={theme.colors.onAccent}
							/>
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

export default ChecklistCreator;
