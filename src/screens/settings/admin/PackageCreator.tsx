import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
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
import db from "../../../constants/firestore";
import { useUser } from "../../../contexts/UserContext";

// Define types for our package data
type Checklist = {
	id: string;
	title: string;
	items: any[];
};

type PackageChecklist = {
	checklistId: string;
};

type Package = {
	id: string;
	title: string;
	description: string;
	checklists: PackageChecklist[];
	createdAt: number;
	updatedAt: number;
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
	useEffect(() => {
		fetchPackages();
		fetchChecklists();
	}, [companyId]);

	// Fetch packages from Firestore
	const fetchPackages = async () => {
		if (!companyId) return;

		try {
			setLoading(true);

			const packagesSnapshot = await db
				.collection("Companies")
				.doc(companyId)
				.collection("Packages")
				.orderBy("updatedAt", "desc")
				.get();

			const fetchedPackages = packagesSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as Package[];

			setPackages(fetchedPackages);
		} catch (error) {
			console.error("Error fetching packages:", error);
			Alert.alert("Error", "Failed to load packages");
		} finally {
			setLoading(false);
		}
	};

	// Fetch available checklists
	const fetchChecklists = async () => {
		if (!companyId) return;

		try {
			setLoadingChecklists(true);

			const checklistsSnapshot = await db
				.collection("Companies")
				.doc(companyId)
				.collection("Checklists")
				.orderBy("title")
				.get();

			const fetchedChecklists = checklistsSnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data(),
			})) as Checklist[];

			setAvailableChecklists(fetchedChecklists);
		} catch (error) {
			console.error("Error fetching checklists:", error);
			Alert.alert("Error", "Failed to load checklists");
		} finally {
			setLoadingChecklists(false);
		}
	};

	// Create new empty package
	const createNewPackage = async () => {
		await fetchChecklists();

		const newPackage: Package = {
			id: "", // Will be assigned by Firestore
			title: "",
			description: "",
			checklists: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		setCurrentPackage(newPackage);
		setSelectedChecklists({});
		setIsEditing(true);
	};

	// Edit existing package
	const editPackage = async (pkg: Package) => {
		await fetchChecklists();

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
		await fetchChecklists();

		const duplicatedPackage: Package = {
			id: "", // Will be assigned by Firestore
			title: `${pkg.title} (Copy)`,
			description: pkg.description,
			checklists: [...pkg.checklists],
			createdAt: Date.now(),
			updatedAt: Date.now(),
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

			await db
				.collection("Companies")
				.doc(companyId)
				.collection("Packages")
				.doc(packageId)
				.delete();

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
				updatedAt: Date.now(),
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
				updatedAt: Date.now(),
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

			const packageData = {
				title: currentPackage.title,
				description: currentPackage.description,
				checklists: currentPackage.checklists,
				createdAt: currentPackage.createdAt,
				updatedAt: Date.now(),
			};

			let packageId = currentPackage.id;

			if (packageId) {
				// Update existing package
				await db
					.collection("Companies")
					.doc(companyId)
					.collection("Packages")
					.doc(packageId)
					.update(packageData);
			} else {
				// Create new package
				const docRef = await db
					.collection("Companies")
					.doc(companyId)
					.collection("Packages")
					.add(packageData);

				packageId = docRef.id;
			}

			// Refresh package list
			await fetchPackages();

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
										updatedAt: Date.now(),
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
										updatedAt: Date.now(),
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
	packageCard: {
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
	packageHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 10,
	},
	packageTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#333",
		flex: 1,
	},
	checklistCount: {
		fontSize: 14,
		color: "#666",
		backgroundColor: "#f0f0f0",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	packageDescription: {
		fontSize: 14,
		color: "#666",
		marginBottom: 15,
	},
	packageChecklists: {
		marginBottom: 15,
	},
	packageChecklistItem: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 5,
	},
	checklistIcon: {
		marginRight: 8,
	},
	packageChecklistTitle: {
		fontSize: 14,
		color: "#333",
	},
	moreChecklists: {
		fontSize: 14,
		color: "#888",
		marginTop: 5,
		fontStyle: "italic",
	},
	packageActions: {
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
		flexDirection: "row",
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
	},
	formGroup: {
		margin: 15,
		marginBottom: 20,
	},
	label: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#333",
		marginBottom: 8,
	},
	sectionDescription: {
		fontSize: 14,
		color: "#666",
		marginBottom: 15,
	},
	input: {
		backgroundColor: "#fff",
		borderWidth: 1,
		borderColor: "#ddd",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
	},
	textArea: {
		minHeight: 100,
		textAlignVertical: "top",
	},
	checklistSelectionContainer: {
		backgroundColor: "#fff",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#ddd",
		overflow: "hidden",
	},
	checklistSelectionItem: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
		backgroundColor: "#fff",
	},
	checklistSelectionContent: {
		flex: 1,
	},
	checklistSelectionTitle: {
		fontSize: 16,
		color: "#333",
		marginBottom: 4,
	},
	checklistSelectionCount: {
		fontSize: 14,
		color: "#666",
	},
	noChecklistsContainer: {
		alignItems: "center",
		justifyContent: "center",
		padding: 30,
		backgroundColor: "#f9f9f9",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#ddd",
		borderStyle: "dashed",
	},
	noChecklistsText: {
		fontSize: 16,
		color: "#666",
		marginVertical: 10,
		textAlign: "center",
	},
	createChecklistButton: {
		backgroundColor: "#2196F3",
		paddingHorizontal: 15,
		paddingVertical: 10,
		borderRadius: 4,
		marginTop: 10,
	},
	createChecklistButtonText: {
		color: "#fff",
		fontWeight: "bold",
	},
	selectedChecklistsContainer: {
		margin: 15,
		marginTop: 0,
		padding: 15,
		backgroundColor: "#f0f7f0",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#c8e6c9",
	},
	selectedChecklistsTitle: {
		fontSize: 16,
		fontWeight: "bold",
		color: "#2E7D32",
		marginBottom: 10,
	},
	selectedChecklistItem: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		borderBottomWidth: 1,
		borderBottomColor: "#c8e6c9",
	},
	selectedChecklistTitle: {
		marginLeft: 10,
		fontSize: 15,
		color: "#333",
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
		backgroundColor: "#f5f5f5",
	},
	cancelButtonText: {
		color: "#333",
		fontSize: 16,
		fontWeight: "500",
	},
});

export default PackageCreator;
