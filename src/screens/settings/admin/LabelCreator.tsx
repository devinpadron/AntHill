import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	TextInput,
	Alert,
	ActivityIndicator,
	StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "../../../contexts/UserContext";
import db from "../../../constants/firestore";
import { Button } from "../../../components/ui/Button";
import { LayoutAnimation, Platform, UIManager } from "react-native";
import ColorPicker from "react-native-wheel-color-picker";

// Enable LayoutAnimation on Android
if (
	Platform.OS === "android" &&
	UIManager.setLayoutAnimationEnabledExperimental
) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LabelCreator = ({ navigation }) => {
	const insets = useSafeAreaInsets();
	const { companyId } = useUser();

	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [labels, setLabels] = useState([]);
	const [labelName, setLabelName] = useState("");
	const [selectedColor, setSelectedColor] = useState("#2196F3");
	const [editingLabel, setEditingLabel] = useState(null);

	// For ScrollView
	const scrollViewRef = useRef(null);

	// Fetch existing labels
	useEffect(() => {
		const fetchLabels = async () => {
			if (!companyId) {
				setLoading(false);
				return;
			}

			try {
				const labelsRef = db
					.collection("Companies")
					.doc(companyId)
					.collection("EventLabels");

				const snapshot = await labelsRef.get();
				const labelData = snapshot.docs.map((doc) => ({
					id: doc.id,
					...doc.data(),
				}));

				setLabels(labelData);
			} catch (error) {
				console.error("Error fetching labels:", error);
				Alert.alert("Error", "Failed to load labels");
			} finally {
				setLoading(false);
			}
		};

		fetchLabels();
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
			const labelsRef = db
				.collection("Companies")
				.doc(companyId)
				.collection("EventLabels");

			if (editingLabel) {
				// Update existing label
				await labelsRef.doc(editingLabel.id).update({
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
				const newLabelRef = await labelsRef.add({
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
						id: newLabelRef.id,
						name: labelName,
						color: selectedColor,
					},
				]);

				Alert.alert("Success", "Label created successfully");
			}

			// Reset form
			setLabelName("");
			setSelectedColor("#2196F3");
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

							await db
								.collection("Companies")
								.doc(companyId)
								.collection("EventLabels")
								.doc(labelId)
								.delete();

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
								setSelectedColor("#2196F3");
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
		setSelectedColor("#2196F3");
	};

	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<StatusBar barStyle="dark-content" />

			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons name="arrow-back" size={24} color="#333" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Event Labels</Text>
				<View style={{ width: 40 }} />
			</View>

			<ScrollView
				ref={scrollViewRef}
				style={styles.scrollView}
				contentContainerStyle={styles.contentContainer}
			>
				{/* Label Creation/Editing Form */}
				<View style={styles.formCard}>
					<View style={styles.formHeader}>
						<Ionicons
							name="pricetag-outline"
							size={20}
							color="#2089dc"
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
								sliderSize={20}
								onColorChange={setSelectedColor}
								color={selectedColor}
								noSnap={true}
								row={false}
								swatchesLast={false}
								swatches={true}
								discrete={false}
								useNativeDriver={false}
								useNativeLayout={false}
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
							color="#2089dc"
							style={styles.listIcon}
						/>
						<Text style={styles.listTitle}>Existing Labels</Text>
					</View>

					{loading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="large" color="#2089dc" />
							<Text style={styles.loadingText}>
								Loading labels...
							</Text>
						</View>
					) : labels.length === 0 ? (
						<View style={styles.emptyContainer}>
							<Ionicons
								name="pricetag"
								size={48}
								color="#e0e0e0"
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
												color="#2089dc"
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
												color="#d32f2f"
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
							color="#666"
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
	scrollView: {
		flex: 1,
	},
	contentContainer: {
		padding: 16,
		paddingBottom: 32,
	},
	formCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	formHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	formIcon: {
		marginRight: 10,
	},
	formTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	formContent: {
		padding: 16,
	},
	inputLabel: {
		fontSize: 14,
		fontWeight: "500",
		color: "#555",
		marginBottom: 8,
	},
	textInput: {
		height: 48,
		borderWidth: 1,
		borderColor: "#e0e0e0",
		borderRadius: 8,
		paddingHorizontal: 16,
		fontSize: 16,
		color: "#333",
		backgroundColor: "#f9f9f9",
	},
	colorContainer: {
		marginTop: 8,
	},
	colorOption: {
		width: 36,
		height: 36,
		borderRadius: 18,
		margin: 6,
	},
	selectedColorOption: {
		borderWidth: 3,
		borderColor: "#333",
	},
	labelPreview: {
		marginTop: 24,
		marginBottom: 16,
	},
	previewTitle: {
		fontSize: 14,
		fontWeight: "500",
		color: "#555",
		marginBottom: 8,
	},
	previewLabel: {
		alignSelf: "flex-start",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 16,
	},
	previewText: {
		color: "white",
		fontWeight: "500",
		fontSize: 14,
		textShadowColor: "rgba(0, 0, 0, 0.3)",
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	buttonContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 16,
	},
	cancelButton: {
		flex: 1,
		marginRight: 8,
		backgroundColor: "transparent",
		borderWidth: 1,
		borderColor: "#999",
	},
	cancelButtonText: {
		color: "#666",
	},
	saveButton: {
		flex: 1,
	},
	listCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
	},
	listHeader: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingTop: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	listIcon: {
		marginRight: 10,
	},
	listTitle: {
		fontSize: 16,
		fontWeight: "600",
		color: "#333",
	},
	loadingContainer: {
		padding: 24,
		alignItems: "center",
	},
	loadingText: {
		marginTop: 8,
		fontSize: 14,
		color: "#666",
	},
	emptyContainer: {
		padding: 24,
		alignItems: "center",
	},
	emptyText: {
		marginTop: 12,
		fontSize: 14,
		color: "#666",
	},
	labelsList: {
		padding: 8,
	},
	labelItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: "#f0f0f0",
	},
	labelItemContent: {
		flexDirection: "row",
		alignItems: "center",
		flex: 1,
	},
	labelColor: {
		width: 24,
		height: 24,
		borderRadius: 12,
		marginRight: 12,
	},
	labelName: {
		fontSize: 16,
		color: "#333",
	},
	labelActions: {
		flexDirection: "row",
	},
	editButton: {
		padding: 8,
		marginRight: 8,
	},
	deleteButton: {
		padding: 8,
	},
	infoCard: {
		backgroundColor: "white",
		borderRadius: 12,
		marginBottom: 16,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 3,
		elevation: 2,
		borderLeftWidth: 4,
		borderLeftColor: "#2089dc",
	},
	infoContent: {
		padding: 16,
		flexDirection: "row",
		alignItems: "flex-start",
	},
	infoIcon: {
		marginRight: 12,
		marginTop: 2,
	},
	infoText: {
		flex: 1,
		fontSize: 14,
		lineHeight: 20,
		color: "#666",
	},
});

export default LabelCreator;
