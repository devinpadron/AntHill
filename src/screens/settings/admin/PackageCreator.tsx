import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	TextInput,
	FlatList,
	Alert,
	ActivityIndicator,
	ScrollView,
	Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { useUser } from "../../../contexts/UserContext";

// Define types for our package data
type Checklist = {
	id: string;
	title: string;
	items: any[];
};

import {
	deletePackage as removePackage,
	savePackage as writePackage,
	subscribeChecklists,
	subscribePackages,
} from "../../../services/libraryService";
import type { Package as PackageDoc } from "../../../types";
import { styles } from "./PackageCreator.styles";

type PackageChecklist = {
	checklistId: string;
};

/*
 * The editor's working shape. v2 persists `checklistIds: string[]`; this keeps
 * the object form the UI already manipulates and converts on load and save,
 * rather than rewriting the picker.
 */
type Package = {
	id: string;
	title: string;
	description: string;
	checklists: PackageChecklist[];
};

const PackageCreator = ({ navigation }) => {
	const { companyId } = useUser();
	const insets = useSafeAreaInsets();

	// States
	const [packages, setPackages] = useState<Package[]>([]);
	const [currentPackage, setCurrentPackage] = useState<Package | null>(null);
	const [availableChecklists, setAvailableChecklists] = useState<Checklist[]>(
		[],
	);
	const [selectedChecklists, setSelectedChecklists] = useState<
		Record<string, boolean>
	>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [loadingChecklists, setLoadingChecklists] = useState(false);

	// Fetch packages on component mount
	useEffect(() => {}, [companyId]);

	// Fetch packages from Firestore
	// Live subscriptions replace the manual fetch-and-refetch cycle.
	useEffect(() => {
		if (!companyId) return;
		return subscribePackages(companyId, (next: PackageDoc[]) => {
			setPackages(
				next.map((pkg) => ({
					id: pkg.id,
					title: pkg.title,
					description: pkg.description,
					checklists: (pkg.checklistIds ?? []).map((checklistId) => ({
						checklistId,
					})),
				})),
			);
			setLoading(false);
		});
	}, [companyId]);

	useEffect(() => {
		if (!companyId) return;
		return subscribeChecklists(companyId, setAvailableChecklists);
	}, [companyId]);

	// Create a new package
	const createNewPackage = () => {
		const newPackage: Package = {
			id: "", // Will be assigned by Firestore
			title: "",
			description: "",
			checklists: [],
		};

		setCurrentPackage(newPackage);
		setSelectedChecklists({});
		setIsEditing(true);
	};

	// Edit existing package
	const editPackage = async (pkg: Package) => {
		setCurrentPackage(pkg);

		// Set up selected checklists based on package
		const selections: Record<string, boolean> = {};
		pkg.checklists.forEach((checklist) => {
			selections[checklist.checklistId] = true;
		});

		setSelectedChecklists(selections);
		setIsEditing(true);
	};

	// Duplicate package
	const duplicatePackage = async (pkg: Package) => {
		const duplicatedPackage: Package = {
			id: "", // Will be assigned by Firestore
			title: `${pkg.title} (Copy)`,
			description: pkg.description,
			checklists: [...pkg.checklists],
		};

		setCurrentPackage(duplicatedPackage);

		// Set up selected checklists based on package
		const selections: Record<string, boolean> = {};
		pkg.checklists.forEach((checklist) => {
			selections[checklist.checklistId] = true;
		});

		setSelectedChecklists(selections);
		setIsEditing(true);
	};

	// Delete package with confirmation
	const confirmDeletePackage = (packageId: string) => {
		Alert.alert(
			"Delete Package",
			"Are you sure you want to delete this package? This action cannot be undone.",
			[
				{
					text: "Cancel",
					style: "cancel",
				},
				{
					text: "Delete",
					onPress: () => deletePackage(packageId),
					style: "destructive",
				},
			],
		);
	};

	// Delete package from Firestore
	const deletePackage = async (packageId: string) => {
		if (!companyId) return;

		try {
			setSaving(true);

			await removePackage(packageId);

			// Update local state
			setPackages(packages.filter((pkg) => pkg.id !== packageId));
			Alert.alert("Success", "Package deleted successfully");
		} catch (error) {
			console.error("Error deleting package:", error);
			Alert.alert("Error", "Failed to delete package");
		} finally {
			setSaving(false);
		}
	};

	// Toggle checklist selection
	const toggleChecklistSelection = (checklistId: string) => {
		// Update selection state
		setSelectedChecklists({
			...selectedChecklists,
			[checklistId]: !selectedChecklists[checklistId],
		});

		// Update current package checklists
		if (!currentPackage) return;

		if (selectedChecklists[checklistId]) {
			// Remove checklist
			setCurrentPackage({
				...currentPackage,
				checklists: currentPackage.checklists.filter(
					(cl) => cl.checklistId !== checklistId,
				),
			});
		} else {
			// Add checklist
			setCurrentPackage({
				...currentPackage,
				checklists: [
					...currentPackage.checklists,
					{
						checklistId: checklistId,
					},
				],
			});
		}
	};

	// Save package to Firestore
	const savePackage = async () => {
		if (!currentPackage || !companyId) return;

		// Validate fields
		if (!currentPackage.title.trim()) {
			Alert.alert("Error", "Please enter a title for the package");
			return;
		}

		try {
			setSaving(true);

			const packageId = await writePackage(companyId, {
				id: currentPackage.id || undefined,
				title: currentPackage.title,
				description: currentPackage.description,
				checklistIds: currentPackage.checklists.map(
					(entry) => entry.checklistId,
				),
			});

			// Refresh package list

			Alert.alert("Success", "Package saved successfully");
			setIsEditing(false);
			setCurrentPackage(null);
		} catch (error) {
			console.error("Error saving package:", error);
			Alert.alert("Error", "Failed to save package");
		} finally {
			setSaving(false);
		}
	};

	// Render an existing package in the list
	const renderPackage = ({ item }: { item: Package }) => (
		<View style={styles.packageCard}>
			<View style={styles.packageHeader}>
				<Text style={styles.packageTitle}>{item.title}</Text>
				<Text style={styles.checklistCount}>
					{item.checklists.length}{" "}
					{item.checklists.length === 1 ? "checklist" : "checklists"}
				</Text>
			</View>

			{item.description ? (
				<Text style={styles.packageDescription} numberOfLines={2}>
					{item.description}
				</Text>
			) : null}

			<View style={styles.packageChecklists}>
				{item.checklists.slice(0, 3).map((checklist) => (
					<View
						key={checklist.checklistId}
						style={styles.packageChecklistItem}
					>
						<Icon
							name="check-circle"
							size={16}
							color="#4CAF50"
							style={styles.checklistIcon}
						/>
						<Text
							style={styles.packageChecklistTitle}
							numberOfLines={1}
						>
							{availableChecklists.find(
								(cl) => cl.id === checklist.checklistId,
							)?.title || "Untitled Checklist"}
						</Text>
					</View>
				))}
				{item.checklists.length > 3 ? (
					<Text style={styles.moreChecklists}>
						+{item.checklists.length - 3} more
					</Text>
				) : null}
			</View>

			<View style={styles.packageActions}>
				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => editPackage(item)}
				>
					<Icon name="edit" size={20} color="#2196F3" />
					<Text style={styles.actionText}>Edit</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => duplicatePackage(item)}
				>
					<Icon name="content-copy" size={20} color="#4CAF50" />
					<Text style={styles.actionText}>Duplicate</Text>
				</TouchableOpacity>

				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => confirmDeletePackage(item.id)}
				>
					<Icon name="delete" size={20} color="#F44336" />
					<Text style={styles.actionText}>Delete</Text>
				</TouchableOpacity>
			</View>
		</View>
	);

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
												setCurrentPackage(null);
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
								? currentPackage?.id
									? "Edit Package"
									: "Create Package"
								: "Manage Packages"}
						</Text>
						<Text style={styles.headerSubtitle}>
							{isEditing
								? "Add or remove checklists from this package"
								: "Create, edit or delete packages"}
						</Text>
					</View>
				</View>
			</View>

			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#0000ff" />
					<Text style={styles.loadingText}>Loading packages...</Text>
				</View>
			) : isEditing ? (
				// Package editor
				<View style={styles.editorContainer}>
					<ScrollView style={{ flex: 1 }}>
						<View style={styles.formGroup}>
							<Text style={styles.label}>Package Title</Text>
							<TextInput
								style={styles.input}
								value={currentPackage?.title || ""}
								onChangeText={(text) =>
									setCurrentPackage({
										...currentPackage!,
										title: text,
									})
								}
								placeholder="Enter package title"
							/>
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>
								Description (Optional)
							</Text>
							<TextInput
								style={[styles.input, styles.textArea]}
								value={currentPackage?.description || ""}
								onChangeText={(text) =>
									setCurrentPackage({
										...currentPackage!,
										description: text,
									})
								}
								placeholder="Enter package description"
								multiline={true}
								numberOfLines={4}
								textAlignVertical="top"
							/>
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Select Checklists</Text>
							<Text style={styles.sectionDescription}>
								Choose which checklists to include in this
								package
							</Text>

							{loadingChecklists ? (
								<ActivityIndicator style={{ marginTop: 20 }} />
							) : availableChecklists.length === 0 ? (
								<View style={styles.noChecklistsContainer}>
									<Icon
										name="error-outline"
										size={48}
										color="#aaa"
									/>
									<Text style={styles.noChecklistsText}>
										No checklists available
									</Text>
									<TouchableOpacity
										style={styles.createChecklistButton}
										onPress={() =>
											navigation.navigate(
												"ChecklistCreator",
											)
										}
									>
										<Text
											style={
												styles.createChecklistButtonText
											}
										>
											Create Checklists
										</Text>
									</TouchableOpacity>
								</View>
							) : (
								<View
									style={styles.checklistSelectionContainer}
								>
									{availableChecklists.map((checklist) => (
										<TouchableOpacity
											key={checklist.id}
											style={
												styles.checklistSelectionItem
											}
											onPress={() =>
												toggleChecklistSelection(
													checklist.id,
												)
											}
										>
											<View
												style={
													styles.checklistSelectionContent
												}
											>
												<Text
													style={
														styles.checklistSelectionTitle
													}
												>
													{checklist.title}
												</Text>
												<Text
													style={
														styles.checklistSelectionCount
													}
												>
													{checklist.items.length}{" "}
													{checklist.items.length ===
													1
														? "item"
														: "items"}
												</Text>
											</View>
											<Switch
												value={
													!!selectedChecklists[
														checklist.id
													]
												}
												onValueChange={() =>
													toggleChecklistSelection(
														checklist.id,
													)
												}
												trackColor={{
													false: "#dddddd",
													true: "#a5d6a7",
												}}
												thumbColor={
													!!selectedChecklists[
														checklist.id
													]
														? "#4CAF50"
														: "#f4f3f4"
												}
											/>
										</TouchableOpacity>
									))}
								</View>
							)}
						</View>

						{currentPackage?.checklists.length ? (
							<View style={styles.selectedChecklistsContainer}>
								<Text style={styles.selectedChecklistsTitle}>
									Selected Checklists (
									{currentPackage.checklists.length})
								</Text>
								{currentPackage.checklists.map((checklist) => (
									<View
										key={checklist.checklistId}
										style={styles.selectedChecklistItem}
									>
										<Icon
											name="check-circle"
											size={20}
											color="#4CAF50"
										/>
										<Text
											style={
												styles.selectedChecklistTitle
											}
										>
											{availableChecklists.find(
												(cl) =>
													cl.id ===
													checklist.checklistId,
											)?.title || "Untitled Checklist"}
										</Text>
									</View>
								))}
							</View>
						) : null}
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
												setCurrentPackage(null);
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
							onPress={savePackage}
							disabled={saving}
						>
							{saving ? (
								<ActivityIndicator
									size="small"
									color="#ffffff"
								/>
							) : (
								<Text style={styles.saveButtonText}>
									Save Package
								</Text>
							)}
						</TouchableOpacity>
					</View>
				</View>
			) : (
				// Packages list view
				<>
					<View style={styles.listContainer}>
						{packages.length === 0 ? (
							<View style={styles.emptyContainer}>
								<Icon
									name="inventory-2"
									size={64}
									color="#ccc"
								/>
								<Text style={styles.emptyText}>
									No packages found
								</Text>
								<Text style={styles.emptySubtext}>
									Create a new package to get started
								</Text>
							</View>
						) : (
							<FlatList
								data={packages}
								renderItem={renderPackage}
								keyExtractor={(item) => item.id}
								contentContainerStyle={styles.listContent}
							/>
						)}
					</View>

					<View style={styles.footer}>
						<TouchableOpacity
							style={styles.createButton}
							onPress={createNewPackage}
						>
							<Icon name="add" size={24} color="#fff" />
							<Text style={styles.createButtonText}>
								Create New Package
							</Text>
						</TouchableOpacity>
					</View>
				</>
			)}
		</View>
	);
};

export default PackageCreator;
