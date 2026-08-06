import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Alert,
	ActivityIndicator,
	StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../../../contexts/UserContext";
import { Button } from "../../../components/ui/Button";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import ColorPicker from "react-native-wheel-color-picker";
import {
	deleteEventLabel,
	saveEventLabel,
	subscribeEventLabels,
} from "../../../services/libraryService";
import { labelStyles } from "./LabelCreator.styles";
import { useTheme, useThemedStyles } from "../../../theme";
import { SafeAreaBand } from "../../../components/ui";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

/*
 * The colour a new label starts on. This is DATA — it is written to the
 * label document and rendered as the company's own choice everywhere else —
 * so it is deliberately not a theme token.
 */
const DEFAULT_LABEL_COLOR = "#2196F3";

const LabelCreator = ({ navigation }) => {
	const theme = useTheme();
	const styles = useThemedStyles(labelStyles);
	const { companyId } = useUser();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [labels, setLabels] = useState([]);
	const [labelName, setLabelName] = useState("");
	const [selectedColor, setSelectedColor] = useState(DEFAULT_LABEL_COLOR);
	const [editingLabel, setEditingLabel] = useState(null);

	// For ScrollView
	const scrollViewRef = useRef(null);

	/*
	 * Live subscription, so a label added on another device appears here — and
	 * the local-state juggling below is now belt-and-braces rather than the
	 * only thing keeping the list current.
	 */
	useEffect(() => {
		if (!companyId) {
			setLoading(false);
			return;
		}

		return subscribeEventLabels(companyId, (next) => {
			setLabels(next);
			setLoading(false);
		});
	}, [companyId]);

	// Handle saving a new label or updating an existing one
	const handleSaveLabel = async () => {
		if (!labelName.trim()) {
			Alert.alert("Error", "Label name cannot be empty");
			return;
		}

		// Check for duplicate name
		const duplicateName = labels.find(
			(label) =>
				label.name.toLowerCase() === labelName.toLowerCase() &&
				(!editingLabel || label.id !== editingLabel.id),
		);

		if (duplicateName) {
			Alert.alert("Error", "A label with this name already exists");
			return;
		}

		setSaving(true);

		try {
			if (editingLabel) {
				// Update existing label
				await saveEventLabel(companyId, {
					id: editingLabel.id,
					name: labelName,
					color: selectedColor,
				});

				// Update local state
				LayoutAnimation.configureNext(
					LayoutAnimation.Presets.easeInEaseOut,
				);
				setLabels((prevLabels) =>
					prevLabels.map((label) =>
						label.id === editingLabel.id
							? {
									...label,
									name: labelName,
									color: selectedColor,
								}
							: label,
					),
				);

				Alert.alert("Success", "Label updated successfully");
			} else {
				// Create new label
				const newLabelId = await saveEventLabel(companyId, {
					name: labelName,
					color: selectedColor,
				});

				// Update local state
				LayoutAnimation.configureNext(
					LayoutAnimation.Presets.easeInEaseOut,
				);
				setLabels((prevLabels) => [
					...prevLabels,
					{
						id: newLabelId,
						name: labelName,
						color: selectedColor,
					},
				]);

				Alert.alert("Success", "Label created successfully");
			}

			// Reset form
			setLabelName("");
			setSelectedColor(DEFAULT_LABEL_COLOR);
			setEditingLabel(null);
		} catch (error) {
			console.error("Error saving label:", error);
			Alert.alert("Error", "Failed to save label");
		} finally {
			setSaving(false);
		}
	};

	// Start editing an existing label
	const handleEditLabel = (label) => {
		setEditingLabel(label);
		setLabelName(label.name);
		setSelectedColor(label.color);

		// Scroll to top to see the form
		setTimeout(() => {
			if (scrollViewRef.current) {
				scrollViewRef.current.scrollTo({ y: 0, animated: true });
			}
		}, 100);
	};

	// Delete a label
	const handleDeleteLabel = (labelId, labelName) => {
		Alert.alert(
			"Delete Label",
			`Are you sure you want to delete "${labelName}"?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: async () => {
						try {
							setLoading(true);

							await deleteEventLabel(labelId);

							// Update local state
							LayoutAnimation.configureNext(
								LayoutAnimation.Presets.easeInEaseOut,
							);
							setLabels((prevLabels) =>
								prevLabels.filter(
									(label) => label.id !== labelId,
								),
							);

							// Reset form if editing the deleted label
							if (editingLabel && editingLabel.id === labelId) {
								setLabelName("");
								setSelectedColor(DEFAULT_LABEL_COLOR);
								setEditingLabel(null);
							}
						} catch (error) {
							console.error("Error deleting label:", error);
							Alert.alert("Error", "Failed to delete label");
						} finally {
							setLoading(false);
						}
					},
				},
			],
		);
	};

	// Cancel editing
	const handleCancelEdit = () => {
		setEditingLabel(null);
		setLabelName("");
		setSelectedColor(DEFAULT_LABEL_COLOR);
	};

	return (
		<View style={styles.container}>
			<SafeAreaBand />
			<StatusBar
				barStyle={theme.isDark ? "light-content" : "dark-content"}
			/>

			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons
						name="arrow-back"
						size={24}
						color={theme.colors.text}
					/>
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Event Labels</Text>
				<View style={{ width: 40 }} />
			</View>

			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={styles.contentContainer}
				automaticallyAdjustKeyboardInsets
				keyboardShouldPersistTaps="handled"
			>
				{/* Label Creation/Editing Form */}
				<View style={styles.formCard}>
					<View style={styles.formHeader}>
						<Ionicons
							name="pricetag-outline"
							size={20}
							color={theme.colors.accent}
							style={styles.formIcon}
						/>
						<Text style={styles.formTitle}>
							{editingLabel ? "Edit Label" : "Create New Label"}
						</Text>
					</View>

					<View style={styles.formContent}>
						<Text style={styles.inputLabel}>Label Name</Text>
						<TextInput
							style={styles.textInput}
							value={labelName}
							onChangeText={setLabelName}
							placeholder="Enter label name"
							maxLength={30}
						/>

						<Text style={[styles.inputLabel, { marginTop: 16 }]}>
							Label Color
						</Text>
						<View style={styles.colorContainer}>
							<ColorPicker
								thumbSize={40}
								sliderSize={25}
								onColorChange={setSelectedColor}
								color={selectedColor}
								noSnap={true}
								row={false}
								swatchesLast={false}
								swatches={true}
								discrete={false}
								useNativeDriver={true}
								useNativeLayout={true}
							/>
						</View>

						<View style={styles.labelPreview}>
							<Text style={styles.previewTitle}>Preview:</Text>
							<View
								style={[
									styles.previewLabel,
									{ backgroundColor: selectedColor },
								]}
							>
								<Text style={styles.previewText}>
									{labelName || "Label Preview"}
								</Text>
							</View>
						</View>

						<View style={styles.buttonContainer}>
							{editingLabel && (
								<Button
									title="Cancel"
									onPress={handleCancelEdit}
									style={styles.cancelButton}
									textStyle={styles.cancelButtonText}
									variant="outline"
								/>
							)}
							<Button
								title={
									editingLabel
										? "Update Label"
										: "Create Label"
								}
								onPress={handleSaveLabel}
								loading={saving}
								disabled={!labelName.trim() || saving}
								style={[
									styles.saveButton,
									editingLabel ? { flex: 1 } : { flex: 0 },
								]}
							/>
						</View>
					</View>
				</View>

				{/* Existing Labels List */}
				<View style={styles.listCard}>
					<View style={styles.listHeader}>
						<Ionicons
							name="list-outline"
							size={20}
							color={theme.colors.accent}
							style={styles.listIcon}
						/>
						<Text style={styles.listTitle}>Existing Labels</Text>
					</View>

					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator
								size="large"
								color={theme.colors.accent}
							/>
							<Text style={styles.loadingText}>
								Loading labels...
							</Text>
						</View>
					) : labels.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Ionicons
								name="pricetag"
								size={48}
								color={theme.colors.border}
							/>
							<Text style={styles.emptyText}>
								No labels created yet
							</Text>
						</View>
					) : (
						<View style={styles.labelsList}>
							{labels.map((label) => (
								<View key={label.id} style={styles.labelItem}>
									<View style={styles.labelItemContent}>
										<View
											style={[
												styles.labelColor,
												{
													backgroundColor:
														label.color,
												},
											]}
										/>
										<Text style={styles.labelName}>
											{label.name}
										</Text>
									</View>

									<View style={styles.labelActions}>
										<TouchableOpacity
											style={styles.editButton}
											onPress={() =>
												handleEditLabel(label)
											}
										>
											<Ionicons
												name="create-outline"
												size={20}
												color={theme.colors.accent}
											/>
										</TouchableOpacity>

										<TouchableOpacity
											style={styles.deleteButton}
											onPress={() =>
												handleDeleteLabel(
													label.id,
													label.name,
												)
											}
										>
											<Ionicons
												name="trash-outline"
												size={20}
												color={theme.colors.danger}
											/>
										</TouchableOpacity>
									</View>
								</View>
							))}
						</View>
					)}
				</View>

				{/* Information card */}
				<View style={styles.infoCard}>
					<View style={styles.infoContent}>
						<Ionicons
							name="information-circle-outline"
							size={24}
							color={theme.colors.textSecondary}
							style={styles.infoIcon}
						/>
						<Text style={styles.infoText}>
							Labels will appear as options when creating or
							editing events on the calendar. They help categorize
							events and make them more visually distinct.
						</Text>
					</View>
				</View>
			</ScrollView>
		</View>
	);
};

export default LabelCreator;
