import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Switch,
	Alert,
	ActivityIndicator,
	Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DropDownPicker from "react-native-dropdown-picker";
import DraggableFlatList from "react-native-draggable-flatlist";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { RouteProp, useRoute } from "@react-navigation/native";
import { useFormSchemaEditor } from "../../../hooks/useFormSchemaEditor";
import { customFormStyles } from "./CompanyCustomForm.styles";
import { useTheme, useThemedStyles } from "../../../theme";
import { FormFieldType } from "../../../types";
import { SafeAreaBand, toast } from "../../../components/ui";
import { useExitGuard } from "../../../hooks/useExitGuard";

const FIELD_TYPES = [
	{ label: "Text Input", value: "text" },
	{ label: "Number Input", value: "number" },
	{ label: "Checkbox", value: "checkbox" },
	{ label: "Checklist", value: "checklist" },
	{ label: "Single Select", value: "select" },
	{ label: "Multi-Select", value: "multiSelect" },
	{ label: "Date", value: "date" },
	{ label: "Time", value: "time" },
	{ label: "Document Upload", value: "document" },
	{ label: "Media Upload", value: "media" },
];

type RootStackParamList = {
	CompanyCustomForm: { isEventForm: boolean };
};

type CompanyCustomFormRouteProp = RouteProp<
	RootStackParamList,
	"CompanyCustomForm"
>;

const CompanyCustomForm = ({ navigation }) => {
	const theme = useTheme();
	const styles = useThemedStyles(customFormStyles);
	const route = useRoute<CompanyCustomFormRouteProp>();
	const isEventForm = route.params?.isEventForm || false;

	const {
		draft: customForm,
		setMeta,
		isLoading,
		isSaving,
		isDirty,
		save: publishForm,
		checklists,
		addField: appendField,
		updateField,
		removeField,
		reorderFields,
		toggleEnabled: toggleFormEnabled,
		resolveFieldEdit,
	} = useFormSchemaEditor(isEventForm);

	// Editor UI state. Which field is open, and the type-specific inputs that
	// live outside the field until the edit is applied.
	const [editingField, setEditingField] = useState(null);
	const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
	const [currentFieldType, setCurrentFieldType] =
		useState<FormFieldType>("text");
	const [currentOptions, setCurrentOptions] = useState("");
	const [showPreview, setShowPreview] = useState(false);
	const [checklistDropdownOpen, setChecklistDropdownOpen] = useState(false);
	const [selectedChecklistId, setSelectedChecklistId] = useState<
		string | null
	>(null);

	// Kept so the JSX can go on calling setCustomForm({...customForm, x}).
	const setCustomForm = setMeta;

	/*
	 * One save, and the screen always says whether it is owed.
	 *
	 * There used to be two: "Save Field" put an edit into the draft, and the
	 * header's "Save" published the draft. Nothing distinguished them, so the
	 * common outcome was pressing Save Field, seeing the list update, and
	 * leaving — with nothing published and no prompt on the way out. Field
	 * edits now land in the draft as they are typed, the header shows whether
	 * the draft differs from what the team has, and leaving with a difference
	 * asks.
	 */
	const saveForm = async (): Promise<boolean> => {
		const saved = await publishForm();
		if (saved) toast.success("Form saved");
		else toast.error("Could not save the form", "Please try again.");
		return saved;
	};

	useExitGuard(navigation, {
		isDirty,
		onSave: saveForm,
		message: "This form has changes that have not been saved yet.",
	});

	// Through editField, so the editor's type picker starts on the new field's
	// type instead of whatever the last field opened was.
	const addField = () => editField(appendField());

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
						removeField(fieldId);
						if (editingField?.id === fieldId) setEditingField(null);
					},
				},
			],
		);
	};

	// What the editor held when it opened, until the first real change. Just
	// opening a field must not rewrite it (resolveFieldEdit normalises), or
	// tapping a row would be enough to mark the form unsaved.
	const openedSnapshot = useRef<string | null>(null);

	const editField = (field) => {
		const options = field.selectOptions?.join(", ") || "";
		const checklistId =
			field.type === "checklist"
				? field.checklistId || null
				: selectedChecklistId;
		openedSnapshot.current = JSON.stringify([
			field,
			field.type,
			options,
			checklistId,
		]);
		setEditingField(field);
		setCurrentFieldType(field.type);
		setCurrentOptions(field.selectOptions?.join(", ") || "");
		if (field.type === "checklist") {
			setSelectedChecklistId(field.checklistId || null);
		}
	};

	// Field edits go straight into the draft — see saveForm.
	useEffect(() => {
		if (!editingField) return;
		if (openedSnapshot.current !== null) {
			const now = JSON.stringify([
				editingField,
				currentFieldType,
				currentOptions,
				selectedChecklistId,
			]);
			if (now === openedSnapshot.current) return;
			openedSnapshot.current = null;
		}
		updateField(
			editingField.id,
			resolveFieldEdit(
				editingField,
				currentFieldType,
				currentOptions,
				selectedChecklistId,
			),
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editingField, currentFieldType, currentOptions, selectedChecklistId]);

	const onDragEnd = ({ data }) => reorderFields(data);

	const calculateMultiplied = (value, multiplier) => {
		if (!multiplier) return value;
		const numValue = parseFloat(value);
		if (isNaN(numValue)) return "";

		const result = numValue * multiplier;
		return result % 1 !== 0 ? result.toFixed(2) : result;
	};

	if (isLoading) {
		return (
			<View style={[styles.container, styles.centered]}>
				<ActivityIndicator size="large" color={theme.colors.accent} />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<SafeAreaBand />
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Ionicons
						name="arrow-back"
						size={24}
						color={theme.colors.text}
					/>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>
					{isEventForm ? "Event form" : "Timesheet form"}
				</Text>
				<TouchableOpacity
					onPress={saveForm}
					disabled={isSaving || !isDirty}
					accessibilityRole="button"
					accessibilityLabel={isDirty ? "Save form" : "Form saved"}
				>
					{isSaving ? (
						<ActivityIndicator
							size="small"
							color={theme.colors.accent}
						/>
					) : (
						<Text
							style={[
								styles.saveButton,
								!isDirty && styles.saveButtonIdle,
							]}
						>
							{isDirty ? "Save" : "Saved"}
						</Text>
					)}
				</TouchableOpacity>
			</View>

			{isDirty && (
				<View style={styles.unsavedBanner}>
					<Ionicons
						name="ellipse"
						size={8}
						color={theme.colors.warning}
					/>
					<Text style={styles.unsavedBannerText}>
						Unsaved changes — your team sees them once you tap Save.
					</Text>
				</View>
			)}

			<ScrollView
				style={styles.content}
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.formControl}>
					<Text style={styles.label}>Form Title</Text>
					<TextInput
						placeholderTextColor={theme.colors.textTertiary}
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
						placeholderTextColor={theme.colors.textTertiary}
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
							trackColor={{
								false: theme.colors.switchTrack,
								true: theme.colors.accent,
							}}
						/>
					</View>
					<Text style={styles.helperText}>
						{customForm.isEnabled
							? isEventForm
								? "Employees fill this in for each event on a time entry they submit"
								: "Employees fill this in when they submit a time entry"
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
								color={theme.colors.borderStrong}
							/>
							<Text style={styles.emptyStateText}>
								No fields added yet. Use the button below to add
								form fields.
							</Text>
						</View>
					) : (
						<DraggableFlatList
							data={customForm.fields}
							keyExtractor={(item: any) => item.id}
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
											<Text
												style={styles.fieldLabel}
												numberOfLines={2}
												ellipsizeMode="tail"
											>
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
													color={theme.colors.danger}
												/>
											</TouchableOpacity>

											<TouchableOpacity
												onLongPress={drag}
											>
												<Ionicons
													name="menu"
													size={22}
													color={
														theme.colors
															.textSecondary
													}
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
						<Ionicons
							name="add-circle"
							size={24}
							color={theme.colors.accent}
						/>
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
									color={theme.colors.textTertiary}
								/>
							</TouchableOpacity>
						</View>

						{currentFieldType !== "checklist" && (
							<View style={styles.formControl}>
								<Text style={styles.label}>Field Label</Text>
								<TextInput
									placeholderTextColor={
										theme.colors.textTertiary
									}
									style={styles.expandableInput}
									value={editingField.label}
									onChangeText={(text) =>
										setEditingField({
											...editingField,
											label: text,
										})
									}
									placeholder="Enter field label"
									multiline
									numberOfLines={1}
									textAlignVertical="center"
								/>
							</View>
						)}

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
								theme={theme.isDark ? "DARK" : "LIGHT"}
								textStyle={styles.dropdownText}
								placeholderStyle={styles.dropdownPlaceholder}
								listItemLabelStyle={styles.dropdownText}
								zIndex={3000}
								zIndexInverse={1000} // Add zIndexInverse for proper stacking
								listMode="SCROLLVIEW" // Use scrollview mode for better rendering
							/>
						</View>

						{currentFieldType !== "checklist" && (
							<View style={styles.formControl}>
								<Text style={styles.label}>Placeholder</Text>
								<TextInput
									placeholderTextColor={
										theme.colors.textTertiary
									}
									style={styles.input}
									value={editingField.placeholder || ""}
									onChangeText={(text) =>
										setEditingField({
											...editingField,
											placeholder: text,
										})
									}
									placeholder="Enter placeholder text"
									maxLength={100}
								/>
								<Text style={styles.charCount}>
									{editingField.placeholder?.length || 0}/100
									characters
								</Text>
							</View>
						)}

						{/* Options: select/multiSelect via comma list; checklist via saved list */}
						{["select", "multiSelect"].includes(
							currentFieldType,
						) && (
							<View style={styles.formControl}>
								<Text style={styles.label}>
									Options (comma separated)
								</Text>
								<TextInput
									placeholderTextColor={
										theme.colors.textTertiary
									}
									style={styles.textArea}
									value={currentOptions}
									onChangeText={setCurrentOptions}
									placeholder={"Option 1, Option 2, Option 3"}
									multiline
									numberOfLines={3}
								/>
							</View>
						)}

						{currentFieldType === "checklist" && (
							<View
								style={[styles.formControl, { zIndex: 2500 }]}
							>
								<Text style={styles.label}>
									Select Checklist
								</Text>
								<DropDownPicker
									open={checklistDropdownOpen}
									value={selectedChecklistId}
									items={checklists.map((c) => ({
										label: c.name,
										value: c.id,
									}))}
									setOpen={setChecklistDropdownOpen}
									setValue={setSelectedChecklistId as any}
									style={styles.dropdown}
									dropDownContainerStyle={styles.dropdownList}
									theme={theme.isDark ? "DARK" : "LIGHT"}
									textStyle={styles.dropdownText}
									placeholderStyle={
										styles.dropdownPlaceholder
									}
									listItemLabelStyle={styles.dropdownText}
									zIndex={2500}
									zIndexInverse={1500}
									listMode="SCROLLVIEW"
									placeholder={
										checklists.length
											? "Choose a checklist"
											: "No checklists found"
									}
									disabled={checklists.length === 0}
									onChangeValue={(value) => {
										// Guard against unnecessary updates that can trigger re-render loops
										if (
											!value ||
											value === editingField?.checklistId
										)
											return;
										const chosen = checklists.find(
											(c) => c.id === value,
										);
										setEditingField({
											...editingField,
											checklistId: value,
											label:
												chosen?.name ||
												"Checklist Field",
										});
									}}
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
									false: theme.colors.switchTrack,
									true: theme.colors.accent,
								}}
							/>
						</View>

						{currentFieldType === "checklist" &&
							editingField.required && (
								<View style={styles.formControl}>
									<Text style={styles.label}>
										Checklist Required Mode
									</Text>
									<View
										style={{
											flexDirection: "row",
											gap: 16,
											marginTop: 4,
										}}
									>
										<TouchableOpacity
											style={{
												flexDirection: "row",
												alignItems: "center",
											}}
											onPress={() =>
												setEditingField({
													...editingField,
													checklistRequiredMode:
														"atLeastOne",
												})
											}
										>
											<Ionicons
												name={
													editingField.checklistRequiredMode ===
														"atLeastOne" ||
													!editingField.checklistRequiredMode
														? "radio-button-on"
														: "radio-button-off"
												}
												size={20}
												color={theme.colors.accent}
											/>
											<Text style={styles.radioLabel}>
												At least one
											</Text>
										</TouchableOpacity>
										<TouchableOpacity
											style={{
												flexDirection: "row",
												alignItems: "center",
											}}
											onPress={() =>
												setEditingField({
													...editingField,
													checklistRequiredMode:
														"all",
												})
											}
										>
											<Ionicons
												name={
													editingField.checklistRequiredMode ===
													"all"
														? "radio-button-on"
														: "radio-button-off"
												}
												size={20}
												color={theme.colors.accent}
											/>
											<Text style={styles.radioLabel}>
												All items
											</Text>
										</TouchableOpacity>
									</View>
								</View>
							)}

						{currentFieldType === "number" && (
							<>
								<View style={styles.switchRow}>
									<View style={styles.labelWithHelp}>
										<Text style={styles.label}>
											Show Total for Multiple Entries
										</Text>
										<TouchableOpacity
											onPress={() =>
												Alert.alert(
													"Number Field Total",
													"When enabled, this number field will show a sum total across all entries when viewing multiple time entries at once.",
												)
											}
										>
											<Ionicons
												name="information-circle-outline"
												size={20}
												color={
													theme.colors.textSecondary
												}
											/>
										</TouchableOpacity>
									</View>
									<Switch
										value={editingField.showTotal || false}
										onValueChange={(value) =>
											setEditingField({
												...editingField,
												showTotal: value,
											})
										}
										trackColor={{
											false: theme.colors.switchTrack,
											true: theme.colors.accent,
										}}
									/>
								</View>

								{/* Add Multiplier Section */}
								<View style={styles.switchRow}>
									<View style={styles.labelWithHelp}>
										<Text style={styles.label}>
											Use Multiplier
										</Text>
										<TouchableOpacity
											onPress={() =>
												Alert.alert(
													"Value Multiplier",
													"When enabled, entered values will be multiplied by the specified factor and shown alongside the original value.",
												)
											}
										>
											<Ionicons
												name="information-circle-outline"
												size={20}
												color={
													theme.colors.textSecondary
												}
											/>
										</TouchableOpacity>
									</View>
									<Switch
										value={
											editingField.useMultiplier || false
										}
										onValueChange={(value) =>
											setEditingField({
												...editingField,
												useMultiplier: value,
											})
										}
										trackColor={{
											false: theme.colors.switchTrack,
											true: theme.colors.accent,
										}}
									/>
								</View>

								{/* Multiplier Input Fields */}
								{editingField.useMultiplier && (
									<View style={styles.multiplierContainer}>
										<View style={styles.formControl}>
											<Text style={styles.label}>
												Multiplier Value
											</Text>
											<TextInput
												placeholderTextColor={
													theme.colors.textTertiary
												}
												style={styles.input}
												value={
													editingField.multiplierText ||
													""
												}
												onChangeText={(text) => {
													// Handle special cases for decimal inputs
													if (
														text === "." ||
														text === ","
													) {
														// Start with "0." when user types just a decimal point
														setEditingField({
															...editingField,
															multiplier: 0, // Store as 0 temporarily
															multiplierText:
																"0.", // Keep the raw text for display
														});
													} else if (text === "") {
														// Handle empty input
														setEditingField({
															...editingField,
															multiplier: null,
															multiplierText: "",
														});
													} else if (
														/^-?\d*\.?\d*$/.test(
															text,
														)
													) {
														// Valid number or number being typed (like "0." or "1.")
														const numValue =
															text.endsWith(".")
																? parseFloat(
																		text +
																			"0",
																	) // Add a temporary 0 for parsing
																: parseFloat(
																		text,
																	);

														setEditingField({
															...editingField,
															multiplier:
																numValue,
															multiplierText:
																text, // Store original text to preserve trailing decimal
														});
													}
													// Ignore invalid inputs
												}}
												placeholder="e.g. 0.8"
												keyboardType="numeric"
											/>
										</View>

										<View style={styles.formControl}>
											<Text style={styles.label}>
												Unit (Optional)
											</Text>
											<TextInput
												placeholderTextColor={
													theme.colors.textTertiary
												}
												style={styles.input}
												value={editingField.unit || ""}
												onChangeText={(text) =>
													setEditingField({
														...editingField,
														unit: text,
													})
												}
												placeholder="e.g. miles, hours, etc."
											/>
										</View>
									</View>
								)}
							</>
						)}

						<TouchableOpacity
							style={styles.saveFieldButton}
							onPress={() => setEditingField(null)}
						>
							<Text style={styles.saveFieldText}>Done</Text>
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
						color={theme.colors.onAccent}
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
											placeholderTextColor={
												theme.colors.textTertiary
											}
											style={styles.previewInput}
											placeholder={
												field.placeholder ||
												`Enter ${field.label.toLowerCase()}`
											}
											editable={false}
										/>
									)}

									{field.type === "number" && (
										<View>
											<TextInput
												placeholderTextColor={
													theme.colors.textTertiary
												}
												style={styles.previewInput}
												placeholder={
													field.placeholder || "0"
												}
												keyboardType="numeric"
												editable={false}
											/>
											{field.useMultiplier && (
												<View
													style={
														styles.previewMultiplier
													}
												>
													<Text
														style={
															styles.previewMultiplierText
														}
													>
														Example: 10 (
														{calculateMultiplied(
															10,
															field.multiplier,
														)}
														{field.unit
															? ` ${field.unit}`
															: ""}
														)
													</Text>
												</View>
											)}
											{field.showTotal && (
												<Text
													style={styles.previewTotal}
												>
													Will show totals across
													multiple entries
												</Text>
											)}
										</View>
									)}

									{field.type === "checkbox" && (
										<View style={styles.checkboxPreview}>
											<Ionicons
												name="square-outline"
												size={24}
												color={
													theme.colors.textSecondary
												}
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
												color={
													theme.colors.textSecondary
												}
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
												color={
													theme.colors.textSecondary
												}
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
												color={
													theme.colors.textSecondary
												}
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
												color={
													theme.colors.textSecondary
												}
											/>
										</View>
									)}

									{field.type === "document" && (
										<View>
											<TouchableOpacity
												style={styles.previewFileUpload}
											>
												<Icon
													name="file-upload-outline"
													size={24}
													color={
														theme.colors
															.textSecondary
													}
												/>
												<Text
													style={
														styles.previewUploadText
													}
												>
													{field.placeholder ||
														"Upload Documents"}
												</Text>
											</TouchableOpacity>
										</View>
									)}

									{field.type === "media" && (
										<View>
											<TouchableOpacity
												style={styles.previewFileUpload}
											>
												<Icon
													name="image-plus"
													size={24}
													color={
														theme.colors
															.textSecondary
													}
												/>
												<Text
													style={
														styles.previewUploadText
													}
												>
													{field.placeholder ||
														"Upload Images/Videos"}
												</Text>
											</TouchableOpacity>
										</View>
									)}

									{field.type === "checklist" && (
										<View style={styles.checklistPreview}>
											<Text
												style={styles.previewSelectText}
											>
												Checklist:{" "}
												{field.checklistName ||
													field.checklistId ||
													"(not selected)"}
											</Text>
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

export default CompanyCustomForm;
