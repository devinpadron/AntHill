import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import DatePicker from "react-native-date-picker";
import { format } from "date-fns";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import AttachmentsSelector from "../ui/AttachmentsSelector";
import { useUser } from "../../contexts/UserContext";
import { getChecklistsByIds } from "../../services/libraryService";
import { checklistCheckedSet } from "../../utils/timeUtils";
import { UploadProgressMap } from "../../contexts/UploadManagerContext";
import { customFormStyles } from "./CustomFormRender.styles";
import { useTheme, useThemedStyles } from "../../theme";
import { FormField, FormFieldType } from "../../types";

/**
 * A form schema plus the local, editable copy of its fields.
 *
 * Not the stored `FormSchema` itself: schema documents are immutable, and this
 * component mutates `fields` in place while a checklist field resolves its
 * items. Structural so callers can pass either a loaded schema or one they
 * assembled.
 */
export type RenderableField = FormField & {
	/** Local dropdown state. UI only — never persisted. */
	isOpen?: boolean;
};

export type RenderableForm = {
	title?: string;
	description?: string;
	fields: RenderableField[];
};

/*
 * DRAFT response values, deliberately not `FormResponses`.
 *
 * While the form is open a media field holds SelectableAttachment[] and a
 * multiSelect holds string[] — neither of which the persisted
 * `FormResponseValue` union describes. That union currently has no consumers
 * anywhere in the app, so it is an unverified model rather than an enforced
 * one, and narrowing to it here would encode a guess about what actually
 * reaches Firestore. Left loose until the submit path is typed end to end.
 */
type DraftResponses = Record<string, any>;

/**
 * DropDownPicker's `setOpen` passes either the next value or an updater.
 * Storing the updater unchanged would leave `isOpen` holding a function, which
 * is truthy — the dropdown would never close.
 */
const resolveOpen = (
	next: boolean | ((prev: boolean) => boolean),
	prev: boolean | undefined,
): boolean => (typeof next === "function" ? next(prev ?? false) : next);

interface CustomFormRenderProps {
	customForm: RenderableForm | null;
	formResponses: DraftResponses;
	/** fieldId -> validation message, for fields that failed submit. */
	formErrors: Record<string, string>;
	onFieldChange: (
		fieldId: string,
		fieldType: FormFieldType,
		value: any,
	) => void;
	setCustomForm: React.Dispatch<React.SetStateAction<RenderableForm | null>>;
	/* The v2 upload manager's map, which also reports "cancelled". */
	uploadProgress?: UploadProgressMap;
	deletionQueue?: string[];
	setDeletionQueue?: React.Dispatch<React.SetStateAction<string[]>>;
}

/**
 * CustomFormRender - A component to render dynamic form fields
 */
const CustomFormRender: React.FC<CustomFormRenderProps> = ({
	customForm,
	formResponses,
	formErrors,
	onFieldChange,
	setCustomForm,
	uploadProgress = {},
	deletionQueue = [],
	setDeletionQueue,
}) => {
	/*
	 * EVERY HOOK RUNS BEFORE ANY EARLY RETURN.
	 *
	 * `if (!customForm) return null` used to sit here, above the useState calls
	 * below. React identifies hooks by call order, so the render where the
	 * schema was still loading ran three hooks and stopped, and the render
	 * after it arrived ran four — which is a Rules of Hooks violation and
	 * crashed the screen the moment the form resolved:
	 *
	 *   React has detected a change in the order of Hooks called by
	 *   CustomFormRender
	 *     3. useMemo   4. undefined -> useState
	 *
	 * It only ever fired when customForm went falsy -> truthy, which is exactly
	 * what opening the editor does. The guard now lives below, after the last
	 * hook.
	 */
	const theme = useTheme();
	/* react-native-date-picker defaults to "auto", which follows the SYSTEM
	   scheme — so a user who forces dark in-app got a light picker. */
	const pickerTheme = theme.isDark ? "dark" : "light";
	const styles = useThemedStyles(customFormStyles);

	const [multiSelect, setMultiSelect] = useState([]);
	const { companyId } = useUser();
	const [checklistItemsByField, setChecklistItemsByField] = useState<{
		[fieldId: string]: string[];
	}>({});
	const [checklistNamesByField, setChecklistNamesByField] = useState<{
		[fieldId: string]: string;
	}>({});

	// Load checklist items for all checklist fields from Firestore
	useEffect(() => {
		const loadChecklistItems = async () => {
			if (!companyId || !customForm?.fields) return;

			const fields = customForm.fields.filter(
				(f) => f.type === "checklist" && f.checklistId,
			);
			if (!fields.length) return;

			/*
			 * ONE batched query for every checklist the form references. v1
			 * issued a separate read per checklist-typed field, on every render
			 * pass where the id list changed.
			 */
			const byId = await getChecklistsByIds(
				companyId,
				fields.map((f) => f.checklistId),
			);

			const newMap: { [fieldId: string]: string[] } = {};
			const newNamesMap: { [fieldId: string]: string } = {};

			for (const field of fields) {
				const checklist = byId[field.checklistId];
				/*
				 * v2 items are always {id, text}. The old `typeof it === "string"`
				 * normalization is gone — the migration converted every legacy
				 * string[] checklist, and production had none left anyway.
				 */
				newMap[field.id] = (checklist?.items ?? [])
					.map((item) => item.text)
					.filter((text) => text && text.trim().length > 0);
				newNamesMap[field.id] = checklist?.title || field.label;
			}

			setChecklistItemsByField(newMap);
			setChecklistNamesByField(newNamesMap);

			// Annotate fields with item counts, which validation elsewhere reads.
			if (Object.keys(newMap).length > 0) {
				setCustomForm((prev) => ({
					...prev,
					fields: prev.fields.map((field) =>
						field.type === "checklist" && field.checklistId
							? {
									...field,
									checklistItemCount:
										newMap[field.id]?.length || 0,
								}
							: field,
					),
				}));
			}
		};

		loadChecklistItems();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [companyId, customForm?.fields?.map((f) => f.checklistId).join(",")]);

	/*
	 * The last hook has run, so it is now safe to bail. Nothing below this line
	 * may call a hook — see the note at the top of the component.
	 */
	if (!customForm) return null;

	// Helper function to calculate multiplied value
	const calculateMultiplied = (value, multiplier) => {
		if (!multiplier) return value;
		const numValue = parseFloat(value);
		if (isNaN(numValue)) return "";

		const result = numValue * multiplier;
		return result % 1 !== 0 ? result.toFixed(2) : result;
	};

	// Render specific field input based on field type
	const renderFieldInput = (field) => {
		switch (field.type) {
			case "text":
				return (
					<TextInput
						style={styles.expandableInput}
						placeholderTextColor={theme.colors.textTertiary}
						placeholder={field.placeholder || ""}
						value={formResponses[field.id] || ""}
						multiline
						onChangeText={(text) =>
							onFieldChange(field.id, field.type, text)
						}
					/>
				);

			case "number":
				return (
					<View>
						<TextInput
							style={styles.textInput}
							placeholderTextColor={theme.colors.textTertiary}
							placeholder={field.placeholder || ""}
							value={formResponses[field.id] || ""}
							onChangeText={(text) =>
								onFieldChange(field.id, field.type, text)
							}
							keyboardType="numeric"
						/>

						{field.useMultiplier &&
							formResponses[field.id] &&
							!isNaN(parseFloat(formResponses[field.id])) && (
								<View style={styles.multiplierResult}>
									<Text style={styles.multiplierText}>
										{formResponses[field.id]} (
										{calculateMultiplied(
											formResponses[field.id],
											field.multiplier,
										)}
										{field.unit ? ` ${field.unit}` : ""})
									</Text>
								</View>
							)}
					</View>
				);

			case "checkbox":
				return (
					<TouchableOpacity
						style={styles.checkboxContainer}
						onPress={() =>
							onFieldChange(
								field.id,
								field.type,
								!formResponses[field.id],
							)
						}
					>
						<View style={styles.checkbox}>
							<Icon
								name={
									formResponses[field.id]
										? "checkbox-marked"
										: "checkbox-blank-outline"
								}
								size={24}
								color={theme.colors.accent}
							/>
						</View>
						<Text style={styles.checkboxLabel}>
							{field.placeholder || field.label}
						</Text>
					</TouchableOpacity>
				);

			case "select":
				return (
					<View
						style={[
							styles.dropdownContainer,
							{
								zIndex: field.isOpen
									? 9999
									: 1000 -
										customForm.fields.findIndex(
											(f) => f.id === field.id,
										),
							},
						]}
					>
						<DropDownPicker
							open={field.isOpen}
							value={formResponses[field.id] || null}
							items={(field.selectOptions || []).map(
								(option) => ({
									label: option,
									value: option,
								}),
							)}
							setOpen={(open) => {
								// Close all other dropdowns when opening this one.
								// DropDownPicker may hand back an updater rather
								// than a boolean, which would otherwise be stored
								// as-is and read as permanently open.
								setCustomForm((prevForm) => ({
									...prevForm,
									fields: prevForm.fields.map((f) => ({
										...f,
										isOpen:
											f.id === field.id
												? resolveOpen(open, f.isOpen)
												: false,
									})),
								}));
							}}
							setValue={(callback) => {
								const value = callback(formResponses[field.id]);
								onFieldChange(field.id, field.type, value);
							}}
							style={styles.dropdown}
							dropDownContainerStyle={styles.dropdownList}
							theme={theme.isDark ? "DARK" : "LIGHT"}
							textStyle={styles.dropdownText}
							placeholderStyle={styles.dropdownPlaceholder}
							listItemLabelStyle={styles.dropdownText}
							selectedItemLabelStyle={styles.dropdownSelectedText}
							placeholder={
								field.placeholder ||
								`Select ${field.label.toLowerCase()}`
							}
							listMode="SCROLLVIEW"
							scrollViewProps={{
								nestedScrollEnabled: true,
							}}
						/>
					</View>
				);

			case "multiSelect":
				return (
					<View
						style={[
							styles.dropdownContainer,
							{
								zIndex: field.isOpen
									? 9999
									: 1000 -
										customForm.fields.findIndex(
											(f) => f.id === field.id,
										),
							},
						]}
					>
						<DropDownPicker
							multiple={true}
							open={field.isOpen}
							value={multiSelect}
							items={(field.selectOptions || []).map(
								(option) => ({
									label: option,
									value: option,
								}),
							)}
							setOpen={(open) => {
								setCustomForm((prevForm) => ({
									...prevForm,
									fields: prevForm.fields.map((f) => ({
										...f,
										isOpen:
											f.id === field.id
												? resolveOpen(open, f.isOpen)
												: false,
									})),
								}));
							}}
							setValue={setMultiSelect}
							onChangeValue={(value) => {
								// Use direct value updates as backup for rapid changes
								if (value !== formResponses[field.id]) {
									onFieldChange(field.id, field.type, value);
								}
							}}
							style={styles.dropdown}
							dropDownContainerStyle={styles.dropdownList}
							theme={theme.isDark ? "DARK" : "LIGHT"}
							textStyle={styles.dropdownText}
							placeholderStyle={styles.dropdownPlaceholder}
							listItemLabelStyle={styles.dropdownText}
							selectedItemLabelStyle={styles.dropdownSelectedText}
							placeholder={
								field.placeholder ||
								`Select ${field.label.toLowerCase()}`
							}
							mode="BADGE"
							badgeColors={[theme.colors.accent]}
							badgeTextStyle={{ color: theme.colors.onAccent }}
							listMode="SCROLLVIEW" // Change to modal for better selection experience
							modalProps={{
								animationType: "fade",
							}}
							modalContentContainerStyle={{
								paddingHorizontal: 10,
								paddingBottom: 20,
							}}
							searchable={field.selectOptions?.length > 8}
							closeAfterSelecting={false}
							disableBorderRadius={false}
							itemSeparator={true}
							itemSeparatorStyle={{
								backgroundColor: theme.colors.border,
							}}
							maxHeight={300}
							// Debounce selection for smoother experience
							autoScroll={true}
							selectedItemContainerStyle={{
								backgroundColor: theme.colors.accentSubtle,
							}}
							// Add checkboxes for clearer UI
							showTickIcon={true}
							tickIconStyle={{
								width: 18,
								height: 18,
							}}
						/>
					</View>
				);

			case "date":
				return (
					<TouchableOpacity
						style={styles.dateButton}
						onPress={() => {
							setCustomForm({
								...customForm,
								fields: customForm.fields.map((f) =>
									f.id === field.id
										? { ...f, showPicker: true }
										: f,
								),
							});
						}}
					>
						<Text
							style={
								formResponses[field.id]
									? styles.dateText
									: styles.datePlaceholder
							}
						>
							{formResponses[field.id]
								? format(
										new Date(formResponses[field.id]),
										"MMMM d, yyyy",
									)
								: field.placeholder || "Select date"}
						</Text>
						<Icon
							name="calendar"
							size={22}
							color={theme.colors.textSecondary}
						/>

						{field.showPicker && (
							<DatePicker
								modal
								open={true}
								date={
									formResponses[field.id]
										? new Date(formResponses[field.id])
										: new Date()
								}
								mode="date"
								theme={pickerTheme}
								onConfirm={(date) => {
									onFieldChange(
										field.id,
										field.type,
										date.toISOString(),
									);
									setCustomForm({
										...customForm,
										fields: customForm.fields.map((f) =>
											f.id === field.id
												? { ...f, showPicker: false }
												: f,
										),
									});
								}}
								onCancel={() => {
									setCustomForm({
										...customForm,
										fields: customForm.fields.map((f) =>
											f.id === field.id
												? { ...f, showPicker: false }
												: f,
										),
									});
								}}
							/>
						)}
					</TouchableOpacity>
				);

			case "time":
				return (
					<TouchableOpacity
						style={styles.dateButton}
						onPress={() => {
							setCustomForm({
								...customForm,
								fields: customForm.fields.map((f) =>
									f.id === field.id
										? { ...f, showPicker: true }
										: f,
								),
							});
						}}
					>
						<Text
							style={
								formResponses[field.id]
									? styles.dateText
									: styles.datePlaceholder
							}
						>
							{formResponses[field.id]
								? format(
										new Date(formResponses[field.id]),
										"h:mm a",
									)
								: field.placeholder || "Select time"}
						</Text>
						<Icon
							name="clock-outline"
							size={22}
							color={theme.colors.textSecondary}
						/>

						{field.showPicker && (
							<DatePicker
								modal
								open={true}
								date={
									formResponses[field.id]
										? new Date(formResponses[field.id])
										: new Date()
								}
								mode="time"
								theme={pickerTheme}
								onConfirm={(time) => {
									onFieldChange(
										field.id,
										field.type,
										time.toISOString(),
									);
									setCustomForm({
										...customForm,
										fields: customForm.fields.map((f) =>
											f.id === field.id
												? { ...f, showPicker: false }
												: f,
										),
									});
								}}
								onCancel={() => {
									setCustomForm({
										...customForm,
										fields: customForm.fields.map((f) =>
											f.id === field.id
												? { ...f, showPicker: false }
												: f,
										),
									});
								}}
							/>
						)}
					</TouchableOpacity>
				);
			case "document":
				return (
					<View style={styles.uploaderContainer}>
						<AttachmentsSelector
							showDocuments
							showMedia={false}
							attachments={formResponses[field.id] || []}
							setAttachments={(attachments) =>
								onFieldChange(field.id, field.type, attachments)
							}
							deletionQueue={deletionQueue}
							setDeletionQueue={setDeletionQueue}
						/>
					</View>
				);

			case "media":
				return (
					<View style={styles.uploaderContainer}>
						<AttachmentsSelector
							showDocuments={false}
							showMedia
							attachments={formResponses[field.id] || []}
							setAttachments={(attachments) =>
								onFieldChange(field.id, field.type, attachments)
							}
							deletionQueue={deletionQueue}
							setDeletionQueue={setDeletionQueue}
							uploadProgress={uploadProgress}
						/>
					</View>
				);

			case "checklist":
				return (
					<View style={styles.checklistContainer}>
						{(checklistItemsByField[field.id] || []).map(
							(option, index) => {
								/*
								 * Normalised, so a response written in an older
								 * shape still reads as ticked. Saving always
								 * writes item TEXT, which converges the format.
								 */
								const checked = checklistCheckedSet(
									formResponses[field.id],
								);
								const checkedItems = [...checked];
								const isChecked = checked.has(option);
								return (
									<TouchableOpacity
										key={index}
										style={styles.checklistItem}
										onPress={() => {
											let newCheckedItems;
											if (isChecked) {
												newCheckedItems =
													checkedItems.filter(
														(item) =>
															item !== option,
													);
											} else {
												newCheckedItems = [
													...checkedItems,
													option,
												];
											}
											onFieldChange(
												field.id,
												field.type,
												newCheckedItems,
											);
										}}
									>
										<View style={styles.checkbox}>
											<Icon
												name={
													isChecked
														? "checkbox-marked"
														: "checkbox-blank-outline"
												}
												size={24}
												color={theme.colors.accent}
											/>
										</View>
										<Text style={styles.checklistLabel}>
											{option}
										</Text>
									</TouchableOpacity>
								);
							},
						)}
					</View>
				);

			default:
				return null;
		}
	};

	return (
		<View style={styles.customFormCard}>
			<Text style={styles.cardTitle}>{customForm.title}</Text>
			{customForm.description && (
				<Text style={styles.formDescription}>
					{customForm.description}
				</Text>
			)}

			{/* Reverse the array to make higher indexed fields render first (lower in the DOM) */}
			{[...customForm.fields].map((field, index) => {
				// Calculate z-index based on position: higher fields get higher z-index
				const baseZIndex = customForm.fields.length - index;

				// Use checklist name as label if field is a checklist
				const displayLabel =
					field.type === "checklist" &&
					checklistNamesByField[field.id]
						? checklistNamesByField[field.id]
						: field.label;

				return (
					<View
						key={field.id}
						style={[
							styles.formField,
							// Give higher z-index to the field being opened
							{
								zIndex: field.isOpen ? 9999 : baseZIndex * 10,
							},
						]}
					>
						<Text style={styles.fieldLabel}>
							{displayLabel}
							{field.required && (
								<Text style={styles.requiredIndicator}>*</Text>
							)}
						</Text>

						{renderFieldInput(field)}

						{formErrors[field.id] && (
							<Text style={styles.errorText}>
								{formErrors[field.id]}
							</Text>
						)}
					</View>
				);
			})}
		</View>
	);
};

export default CustomFormRender;
