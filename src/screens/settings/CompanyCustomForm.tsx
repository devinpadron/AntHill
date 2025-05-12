import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Switch,
	Alert,
	ActivityIndicator,
	Platform,
} from "react-native";
import { useUser } from "../../contexts/UserContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DropDownPicker from "react-native-dropdown-picker";
import DraggableFlatList from "react-native-draggable-flatlist";
import {
	getCompanyPreferences,
	updateCompanyPreferences,
} from "../../services/companyService";

// Form field types
const FIELD_TYPES = [
	{ label: "Text Input", value: "text" },
	{ label: "Number Input", value: "number" },
	{ label: "Checkbox", value: "checkbox" },
	{ label: "Single Select", value: "select" },
	{ label: "Multi-Select", value: "multiSelect" },
	{ label: "Date", value: "date" },
	{ label: "Time", value: "time" },
];

const CompanyCustomForm = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const { companyId } = useUser();

	// Form state
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [customForm, setCustomForm] = useState({
		title: "Time Entry Form",
		description:
			"Please complete this form when submitting your time entry",
		fields: [],
		isEnabled: true,
	});

	// UI state
	const [editingField, setEditingField] = useState(null);
	const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
	const [currentFieldType, setCurrentFieldType] = useState("text");
	const [currentOptions, setCurrentOptions] = useState("");
	const [showPreview, setShowPreview] = useState(false);

	// Load existing form configuration
	useEffect(() => {
		const loadPreferences = async () => {
			if (!companyId) return;

			try {
				setIsLoading(true);
				const preferences = await getCompanyPreferences(companyId);

				if (preferences?.timeEntryForm) {
					setCustomForm(preferences.timeEntryForm);
				}
			} catch (error) {
				console.error("Failed to load company preferences:", error);
				Alert.alert("Error", "Failed to load company preferences");
			} finally {
				setIsLoading(false);
			}
		};

		loadPreferences();
	}, [companyId]);

	// Save form configuration
	const saveForm = async () => {
		if (!companyId) return;

		try {
			setIsSaving(true);
			await updateCompanyPreferences(companyId, {
				timeEntryForm: customForm,
			});
			Alert.alert(
				"Success",
				"Time entry form settings saved successfully",
			);
		} catch (error) {
			console.error("Failed to save form:", error);
			Alert.alert("Error", "Failed to save time entry form");
		} finally {
			setIsSaving(false);
		}
	};

	// Add a new field
	const addField = () => {
		const newField = {
			id: Date.now().toString(),
			type: "text",
			label: "New Field",
			placeholder: "",
			required: false,
		};

		setCustomForm({
			...customForm,
			fields: [...customForm.fields, newField],
		});

		setEditingField(newField);
	};

	// Delete a field
	const deleteField = (fieldId) => {
		Alert.alert(
			"Delete Field",
			"Are you sure you want to delete this field?",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => {
						setCustomForm({
							...customForm,
							fields: customForm.fields.filter(
								(field) => field.id !== fieldId,
							),
						});

						if (editingField?.id === fieldId) {
							setEditingField(null);
						}
					},
				},
			],
		);
	};

	// Update field props
	const updateField = (fieldId, updates) => {
		setCustomForm({
			...customForm,
			fields: customForm.fields.map((field) =>
				field.id === fieldId ? { ...field, ...updates } : field,
			),
		});

		if (editingField?.id === fieldId) {
			setEditingField({ ...editingField, ...updates });
		}
	};

	// Edit field
	const editField = (field) => {
		setEditingField(field);
		setCurrentFieldType(field.type);
		setCurrentOptions(field.options?.join(", ") || "");
	};

	// Save field changes
	const saveFieldChanges = () => {
		if (!editingField) return;

		const updatedField = {
			...editingField,
			type: currentFieldType,
		};

		// Handle options for select/multiSelect
		if (["select", "multiSelect"].includes(currentFieldType)) {
			updatedField.options = currentOptions
				.split(",")
				.map((option) => option.trim())
				.filter((option) => option);
		}

		updateField(editingField.id, updatedField);
		setEditingField(null);
	};

	// Handle field reordering
	const onDragEnd = ({ data }) => {
		setCustomForm({ ...customForm, fields: data });
	};

	// Toggle form enabled state
	const toggleFormEnabled = () => {
		setCustomForm({ ...customForm, isEnabled: !customForm.isEnabled });
	};

	if (isLoading) {
		return (
			<View style={[styles.container, styles.centered]}>
				<ActivityIndicator size="large" color="#007AFF" />
			</View>
		);
	}

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Ionicons name="arrow-back" size={24} color="#333" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Custom Time Entry Forms</Text>
				<TouchableOpacity onPress={saveForm} disabled={isSaving}>
					{isSaving ? (
						<ActivityIndicator size="small" color="#007AFF" />
					) : (
						<Text style={styles.saveButton}>Save</Text>
					)}
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.content}>
				<View style={styles.formControl}>
					<Text style={styles.label}>Form Title</Text>
					<TextInput
						style={styles.input}
						value={customForm.title}
						onChangeText={(text) =>
							setCustomForm({ ...customForm, title: text })
						}
						placeholder="Enter form title"
					/>
				</View>

				<View style={styles.formControl}>
					<Text style={styles.label}>Description</Text>
					<TextInput
						style={styles.textArea}
						value={customForm.description}
						onChangeText={(text) =>
							setCustomForm({ ...customForm, description: text })
						}
						placeholder="Enter form description"
						multiline
						numberOfLines={3}
					/>
				</View>

				<View style={styles.formControl}>
					<View style={styles.switchRow}>
						<Text style={styles.label}>Enable Custom Form</Text>
						<Switch
							value={customForm.isEnabled}
							onValueChange={toggleFormEnabled}
							trackColor={{ false: "#767577", true: "#007AFF" }}
						/>
					</View>
					<Text style={styles.helperText}>
						{customForm.isEnabled
							? "Custom form will be displayed when employees submit time entries"
							: "Custom form is disabled"}
					</Text>
				</View>

				<View style={styles.formSection}>
					<Text style={styles.sectionTitle}>Form Fields</Text>

					{customForm.fields.length === 0 ? (
						<View style={styles.emptyState}>
							<Ionicons
								name="document-text-outline"
								size={48}
								color="#ccc"
							/>
							<Text style={styles.emptyStateText}>
								No fields added yet. Use the button below to add
								form fields.
							</Text>
						</View>
					) : (
						<DraggableFlatList
							data={customForm.fields}
							keyExtractor={(item) => item.id}
							scrollEnabled={false}
							onDragEnd={onDragEnd}
							renderItem={({ item, drag, isActive }) => (
								<TouchableOpacity
									style={[
										styles.fieldItem,
										isActive && styles.draggingField,
										editingField?.id === item.id &&
											styles.selectedField,
									]}
									onPress={() => editField(item)}
									disabled={isActive}
								>
									<View style={styles.fieldContent}>
										<View style={styles.fieldInfo}>
											<Text style={styles.fieldType}>
												{item.type.toUpperCase()}
											</Text>
											<Text style={styles.fieldLabel}>
												{item.label}
											</Text>
											{item.required && (
												<View
													style={styles.requiredBadge}
												>
													<Text
														style={
															styles.requiredText
														}
													>
														REQUIRED
													</Text>
												</View>
											)}
										</View>

										<View style={styles.fieldActions}>
											<TouchableOpacity
												onPress={() =>
													deleteField(item.id)
												}
											>
												<Ionicons
													name="trash-outline"
													size={22}
													color="#FF3B30"
												/>
											</TouchableOpacity>

											<TouchableOpacity
												onLongPress={drag}
											>
												<Ionicons
													name="menu"
													size={22}
													color="#777"
												/>
											</TouchableOpacity>
										</View>
									</View>
								</TouchableOpacity>
							)}
						/>
					)}

					<TouchableOpacity
						style={styles.addButton}
						onPress={addField}
					>
						<Ionicons name="add-circle" size={24} color="#007AFF" />
						<Text style={styles.addButtonText}>Add New Field</Text>
					</TouchableOpacity>
				</View>

				{/* Field Editor */}
				{editingField && (
					<View style={styles.fieldEditor}>
						<View style={styles.editorHeader}>
							<Text style={styles.editorTitle}>Edit Field</Text>
							<TouchableOpacity
								onPress={() => setEditingField(null)}
							>
								<Ionicons
									name="close-circle"
									size={24}
									color="#999"
								/>
							</TouchableOpacity>
						</View>

						<View style={styles.formControl}>
							<Text style={styles.label}>Field Label</Text>
							<TextInput
								style={styles.input}
								value={editingField.label}
								onChangeText={(text) =>
									setEditingField({
										...editingField,
										label: text,
									})
								}
								placeholder="Enter field label"
							/>
						</View>

						<View
							style={[
								styles.formControl,
								{ zIndex: 3000 }, // Add high zIndex to the container
							]}
						>
							<Text style={styles.label}>Field Type</Text>
							<DropDownPicker
								open={typeDropdownOpen}
								value={currentFieldType}
								items={FIELD_TYPES}
								setOpen={setTypeDropdownOpen}
								setValue={setCurrentFieldType}
								style={styles.dropdown}
								dropDownContainerStyle={styles.dropdownList}
								zIndex={3000}
								zIndexInverse={1000} // Add zIndexInverse for proper stacking
								listMode="SCROLLVIEW" // Use scrollview mode for better rendering
							/>
						</View>

						<View style={styles.formControl}>
							<Text style={styles.label}>Placeholder</Text>
							<TextInput
								style={styles.input}
								value={editingField.placeholder || ""}
								onChangeText={(text) =>
									setEditingField({
										...editingField,
										placeholder: text,
									})
								}
								placeholder="Enter placeholder text"
							/>
						</View>

						{["select", "multiSelect"].includes(
							currentFieldType,
						) && (
							<View style={styles.formControl}>
								<Text style={styles.label}>
									Options (comma separated)
								</Text>
								<TextInput
									style={styles.textArea}
									value={currentOptions}
									onChangeText={setCurrentOptions}
									placeholder="Option 1, Option 2, Option 3"
									multiline
									numberOfLines={3}
								/>
							</View>
						)}

						<View style={styles.switchRow}>
							<Text style={styles.label}>Required Field</Text>
							<Switch
								value={editingField.required || false}
								onValueChange={(value) =>
									setEditingField({
										...editingField,
										required: value,
									})
								}
								trackColor={{
									false: "#767577",
									true: "#007AFF",
								}}
							/>
						</View>

						<TouchableOpacity
							style={styles.saveFieldButton}
							onPress={saveFieldChanges}
						>
							<Text style={styles.saveFieldText}>Save Field</Text>
						</TouchableOpacity>
					</View>
				)}

				{/* Preview Button */}
				<TouchableOpacity
					style={styles.previewButton}
					onPress={() => setShowPreview(!showPreview)}
				>
					<Ionicons
						name={showPreview ? "eye-off" : "eye"}
						size={22}
						color="white"
					/>
					<Text style={styles.previewButtonText}>
						{showPreview ? "Hide Preview" : "Show Preview"}
					</Text>
				</TouchableOpacity>

				{/* Form Preview */}
				{showPreview && (
					<View style={styles.preview}>
						<Text style={styles.previewTitle}>Form Preview</Text>
						<View style={styles.previewForm}>
							<Text style={styles.previewFormTitle}>
								{customForm.title}
							</Text>
							{customForm.description && (
								<Text style={styles.previewDescription}>
									{customForm.description}
								</Text>
							)}

							{customForm.fields.map((field) => (
								<View
									key={field.id}
									style={styles.previewField}
								>
									<Text style={styles.previewLabel}>
										{field.label}{" "}
										{field.required && (
											<Text style={styles.required}>
												*
											</Text>
										)}
									</Text>

									{field.type === "text" && (
										<TextInput
											style={styles.previewInput}
											placeholder={
												field.placeholder ||
												`Enter ${field.label.toLowerCase()}`
											}
											editable={false}
										/>
									)}

									{field.type === "number" && (
										<TextInput
											style={styles.previewInput}
											placeholder={
												field.placeholder || "0"
											}
											keyboardType="numeric"
											editable={false}
										/>
									)}

									{field.type === "checkbox" && (
										<View style={styles.checkboxPreview}>
											<Ionicons
												name="square-outline"
												size={24}
												color="#777"
											/>
											<Text
												style={
													styles.checkboxPreviewLabel
												}
											>
												{field.placeholder ||
													field.label}
											</Text>
										</View>
									)}

									{field.type === "select" && (
										<View style={styles.previewSelect}>
											<Text
												style={styles.previewSelectText}
											>
												{field.placeholder ||
													"Select an option"}
											</Text>
											<Ionicons
												name="chevron-down"
												size={20}
												color="#777"
											/>
										</View>
									)}

									{field.type === "multiSelect" && (
										<View style={styles.previewSelect}>
											<Text
												style={styles.previewSelectText}
											>
												{field.placeholder ||
													"Select options"}
											</Text>
											<Ionicons
												name="chevron-down"
												size={20}
												color="#777"
											/>
										</View>
									)}

									{field.type === "date" && (
										<View style={styles.previewDate}>
											<Text
												style={styles.previewDateText}
											>
												Select date
											</Text>
											<Ionicons
												name="calendar"
												size={20}
												color="#777"
											/>
										</View>
									)}

									{field.type === "time" && (
										<View style={styles.previewDate}>
											<Text
												style={styles.previewDateText}
											>
												Select time
											</Text>
											<Ionicons
												name="time"
												size={20}
												color="#777"
											/>
										</View>
									)}
								</View>
							))}
						</View>
					</View>
				)}
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f8f9fa",
	},
	centered: {
		justifyContent: "center",
		alignItems: "center",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 16,
		backgroundColor: "white",
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	saveButton: {
		fontSize: 16,
		fontWeight: "600",
		color: "#007AFF",
	},
	content: {
		flex: 1,
		padding: 16,
	},
	formControl: {
		marginBottom: 20,
	},
	label: {
		fontSize: 16,
		fontWeight: "500",
		marginBottom: 8,
		color: "#333",
	},
	input: {
		height: 48,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 8,
		paddingHorizontal: 12,
		fontSize: 16,
		backgroundColor: "white",
	},
	textArea: {
		minHeight: 80,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingTop: 12,
		fontSize: 16,
		backgroundColor: "white",
		textAlignVertical: "top",
	},
	switchRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 8,
	},
	helperText: {
		fontSize: 14,
		color: "#666",
		marginTop: 4,
	},
	formSection: {
		marginTop: 10,
		marginBottom: 24,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: 16,
		color: "#333",
	},
	emptyState: {
		alignItems: "center",
		justifyContent: "center",
		padding: 30,
		backgroundColor: "white",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#e1e4e8",
		borderStyle: "dashed",
	},
	emptyStateText: {
		marginTop: 10,
		fontSize: 15,
		color: "#666",
		textAlign: "center",
	},
	fieldItem: {
		backgroundColor: "white",
		padding: 16,
		borderRadius: 8,
		marginBottom: 10,
		borderWidth: 1,
		borderColor: "#e1e4e8",
	},
	selectedField: {
		borderColor: "#007AFF",
		backgroundColor: "#f0f7ff",
	},
	draggingField: {
		opacity: 0.7,
		transform: [{ scale: 1.05 }],
		elevation: 5,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 4,
	},
	fieldContent: {
		flexDirection: "row",
		justifyContent: "space-between",
	},
	fieldInfo: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	fieldType: {
		fontSize: 12,
		backgroundColor: "#e1e4e8",
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 4,
		color: "#555",
		marginRight: 8,
	},
	fieldLabel: {
		fontSize: 16,
		color: "#333",
	},
	requiredBadge: {
		backgroundColor: "#ff9500",
		marginLeft: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
	},
	requiredText: {
		fontSize: 10,
		color: "white",
		fontWeight: "600",
	},
	fieldActions: {
		flexDirection: "row",
		alignItems: "center",
		width: 70,
		justifyContent: "space-between",
	},
	addButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		padding: 12,
		backgroundColor: "white",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#007AFF",
		marginTop: 10,
	},
	addButtonText: {
		marginLeft: 8,
		color: "#007AFF",
		fontWeight: "500",
		fontSize: 16,
	},
	fieldEditor: {
		backgroundColor: "white",
		padding: 16,
		borderRadius: 8,
		marginVertical: 16,
		borderWidth: 1,
		borderColor: "#e1e4e8",
		// These are important for proper dropdown rendering
		zIndex: 1000,
		elevation: Platform.OS === "android" ? 3 : 0,
		position: "relative",
	},
	editorHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#e1e4e8",
	},
	editorTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
	},
	dropdown: {
		borderColor: "#ccc",
		height: 48,
		backgroundColor: "white",
	},
	dropdownList: {
		borderColor: "#ccc",
		backgroundColor: "white",
		elevation: 5,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	saveFieldButton: {
		backgroundColor: "#007AFF",
		borderRadius: 8,
		paddingVertical: 12,
		alignItems: "center",
		marginTop: 16,
	},
	saveFieldText: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
	},
	previewButton: {
		backgroundColor: "#5856d6",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		padding: 12,
		borderRadius: 8,
		marginVertical: 16,
	},
	previewButtonText: {
		color: "white",
		marginLeft: 8,
		fontSize: 16,
		fontWeight: "500",
	},
	preview: {
		backgroundColor: "#f0f0f0",
		borderRadius: 8,
		padding: 16,
		marginBottom: 24,
	},
	previewTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
		marginBottom: 12,
	},
	previewForm: {
		backgroundColor: "white",
		borderRadius: 8,
		padding: 16,
		borderWidth: 1,
		borderColor: "#ddd",
	},
	previewFormTitle: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		marginBottom: 8,
	},
	previewDescription: {
		fontSize: 14,
		color: "#666",
		marginBottom: 16,
	},
	previewField: {
		marginBottom: 16,
	},
	previewLabel: {
		fontSize: 15,
		fontWeight: "500",
		marginBottom: 6,
		color: "#333",
	},
	required: {
		color: "red",
	},
	previewInput: {
		height: 42,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 6,
		paddingHorizontal: 10,
	},
	checkboxPreview: {
		flexDirection: "row",
		alignItems: "center",
	},
	checkboxPreviewLabel: {
		marginLeft: 8,
		fontSize: 15,
		color: "#333",
	},
	previewSelect: {
		height: 42,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 6,
		paddingHorizontal: 12,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	previewSelectText: {
		fontSize: 15,
		color: "#999",
	},
	previewDate: {
		height: 42,
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 6,
		paddingHorizontal: 12,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	previewDateText: {
		fontSize: 15,
		color: "#999",
	},
});

export default CompanyCustomForm;
