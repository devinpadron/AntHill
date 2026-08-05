import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	Dimensions,
	Alert,
	LayoutAnimation,
	Platform,
	UIManager,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "../../contexts/UserContext";
import { getChecklistsByIds } from "../../services/libraryService";
import {
	setItemState as writeItemState,
	subscribeChecklistState,
} from "../../services/eventChecklistService";
import { styles } from "./EventChecklists.styles";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
	if (UIManager.setLayoutAnimationEnabledExperimental) {
		UIManager.setLayoutAnimationEnabledExperimental(true);
	}
}

// Constants for item states
const UNCHECKED = 0;
const CHECKED = 1;
const STRIKETHROUGH = 2;

const EventChecklists = () => {
	// Update the route params extraction to get checklistIds
	const route = useRoute<any>();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	console.log("Route params:", route.params);
	const { checklistIds, eventId } = route.params || {}; // Add eventId from route params
	const { companyId } = useUser();

	const [loading, setLoading] = useState(true);
	const [checklists, setChecklists] = useState([]);
	const [itemStates, setItemStates] = useState({});
	const [savedState, setSavedState] = useState({});

	// Load checklists from the provided IDs
	useEffect(() => {
		let unsubscribeFunction = null;

		const fetchChecklists = async () => {
			if (
				!checklistIds ||
				!Array.isArray(checklistIds) ||
				checklistIds.length === 0 ||
				!companyId
			) {
				setLoading(false);
				return;
			}

			try {
				// ONE batched query. v1 issued a read per checklist id.
				const byId = await getChecklistsByIds(companyId, checklistIds);
				const checklistItems = checklistIds
					.map((id) => byId[id])
					.filter(Boolean);

				const initialItemStates = {};
				checklistItems.forEach((checklist) => {
					initialItemStates[checklist.id] = {};
					(checklist.items || []).forEach((item) => {
						initialItemStates[checklist.id][item.id] = UNCHECKED;
					});
				});

				setChecklists(checklistItems);
				setItemStates(initialItemStates);
			} catch (error) {
				console.error("Error loading checklists:", error);
				Alert.alert("Error", "Failed to load checklists");
			} finally {
				setLoading(false);
			}
		};

		fetchChecklists();
		return () => {
			if (unsubscribeFunction) {
				unsubscribeFunction();
			}
		};
	}, [checklistIds, companyId, eventId]);

	// Keep track of both initial load and when data has stabilized
	const hasInitializedRef = useRef(false);
	const [animationsEnabled, setAnimationsEnabled] = useState(false);

	// After initial data loading is complete, enable animations
	useEffect(() => {
		if (!loading && !hasInitializedRef.current) {
			hasInitializedRef.current = true;
			// Delay enabling animations until after initial render cycle
			setTimeout(() => {
				setAnimationsEnabled(true);
			}, 500); // Small delay to ensure UI is stable
		}
	}, [loading]);

	useEffect(() => {
		// Add function to load saved checklist states

		let unsubscribeFunction = null;

		const loadSavedChecklistStates = async () => {
			if (!eventId || !companyId) return;

			try {
				/*
				 * ONE document per event holds every checklist's state, rather
				 * than a document per checklist. Synchronous unsubscribe —
				 * the v1 helper was `async`, so this variable held a Promise
				 * and the listener was never actually torn down.
				 */
				unsubscribeFunction = subscribeChecklistState(
					eventId,
					(doc) => {
						const savedStates = doc?.state ?? {};

						setSavedState(savedStates);

						// Only apply animations after initial data has loaded and stabilized
						if (animationsEnabled) {
							LayoutAnimation.configureNext({
								duration: 300,
								update: {
									type: LayoutAnimation.Types.easeInEaseOut,
								},
								create: {
									type: LayoutAnimation.Types.easeInEaseOut,
									property:
										LayoutAnimation.Properties.opacity,
								},
								delete: {
									type: LayoutAnimation.Types.easeInEaseOut,
									property:
										LayoutAnimation.Properties.opacity,
								},
							});
						}

						// Update itemStates with saved values
						setItemStates((prevStates) => {
							const newStates = { ...prevStates };

							// For each checklist that has saved state
							Object.keys(savedStates).forEach((checklistId) => {
								if (newStates[checklistId]) {
									// Merge the saved state with current state
									newStates[checklistId] = {
										...newStates[checklistId],
										...savedStates[checklistId],
									};
								}
							});

							return newStates;
						});
					},
				);
			} catch (error) {
				console.error("Error loading saved checklist states:", error);
			}
		};
		loadSavedChecklistStates();
		return () => {
			if (unsubscribeFunction) {
				unsubscribeFunction();
			}
		};
	}, [checklists, companyId, eventId, animationsEnabled]); // Add animationsEnabled dependency

	/*
	 * Writes ONE item, as a dotted field path.
	 *
	 * v1 sent the whole checklist map through a `.set()` without merge, so two
	 * workers ticking different items on the same event overwrote each other —
	 * whoever wrote second wiped the other's ticks.
	 */
	const saveItemState = async (checklistId, itemId, state) => {
		if (!eventId || !companyId) return;

		try {
			await writeItemState(
				companyId,
				eventId,
				checklistId,
				itemId,
				state,
			);
		} catch (error) {
			console.error("Error saving checklist state:", error);
			Alert.alert("Error", "Failed to save checklist state");
		}
	};

	// Toggle item state with animation
	const toggleItemState = (checklistId, itemId) => {
		// Configure the animation to use when updating the list
		LayoutAnimation.configureNext({
			duration: 300,
			update: {
				type: LayoutAnimation.Types.easeInEaseOut,
			},
			create: {
				type: LayoutAnimation.Types.easeInEaseOut,
				property: LayoutAnimation.Properties.opacity,
			},
			delete: {
				type: LayoutAnimation.Types.easeInEaseOut,
				property: LayoutAnimation.Properties.opacity,
			},
		});

		setItemStates((prevStates) => {
			const currentState = prevStates[checklistId][itemId];
			const newState = (currentState + 1) % 3; // Cycle through states 0, 1, 2

			const updatedChecklistState = {
				...prevStates[checklistId],
				[itemId]: newState,
			};

			// Only the item that changed is written.
			saveItemState(checklistId, itemId, newState);

			return {
				...prevStates,
				[checklistId]: updatedChecklistState,
			};
		});
	};

	// Check if all items in a checklist are checked
	const isChecklistComplete = (checklistId) => {
		if (!itemStates[checklistId]) return false;

		const checklist = checklists.find((cl) => cl.id === checklistId);
		if (!checklist || !checklist.items || checklist.items.length === 0)
			return false;

		return checklist.items.every(
			(item) =>
				itemStates[checklistId][item.id] === CHECKED ||
				itemStates[checklistId][item.id] === STRIKETHROUGH,
		);
	};

	// Calculate progress percentage for current checklist
	const getProgressPercentage = (checklistId) => {
		const checklist = checklists.find((cl) => cl.id === checklistId);
		if (!checklist || !checklist.items || checklist.items.length === 0)
			return 0;

		const totalItems = checklist.items.length;
		const completedItems = checklist.items.filter(
			(item) =>
				itemStates[checklistId][item.id] === CHECKED ||
				itemStates[checklistId][item.id] === STRIKETHROUGH,
		).length;

		return Math.round((completedItems / totalItems) * 100);
	};

	if (loading) {
		return (
			<View style={[styles.container, { paddingTop: insets.top }]}>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						<Ionicons name="arrow-back" size={24} color="#333" />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Loading Checklists</Text>
					<View style={{ width: 40 }} />
				</View>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#2089dc" />
					<Text style={styles.loadingText}>
						Loading checklists...
					</Text>
				</View>
			</View>
		);
	}

	if (checklists.length === 0) {
		return (
			<View style={[styles.container, { paddingTop: insets.top }]}>
				<View style={styles.header}>
					<TouchableOpacity
						style={styles.backButton}
						onPress={() => navigation.goBack()}
					>
						<Ionicons name="arrow-back" size={24} color="#333" />
					</TouchableOpacity>
					<Text style={styles.headerTitle}>Checklists</Text>
					<View style={{ width: 40 }} />
				</View>
				<View style={styles.emptyContainer}>
					<Ionicons name="list" size={64} color="#ccc" />
					<Text style={styles.emptyTitle}>
						No Checklists Available
					</Text>
					<Text style={styles.emptyText}>
						No valid checklists were found for this selection.
					</Text>
				</View>
			</View>
		);
	}

	// Replace the return statement with this updated continuous layout
	return (
		<View style={[styles.container, { paddingTop: insets.top }]}>
			<View style={styles.header}>
				<TouchableOpacity
					style={styles.backButton}
					onPress={() => navigation.goBack()}
				>
					<Ionicons name="arrow-back" size={24} color="#333" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>
					Checklists ({checklists.length})
				</Text>
				<View style={{ width: 40 }} />
			</View>

			<ScrollView
				style={styles.scrollContainer}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={true}
			>
				{checklists.map((checklist) => {
					const isComplete = isChecklistComplete(checklist.id);
					const progressPercentage = getProgressPercentage(
						checklist.id,
					);

					return (
						<View
							key={checklist.id}
							style={styles.checklistSection}
						>
							<View style={styles.checklistHeader}>
								<View style={styles.titleContainer}>
									<Text
										style={[
											styles.checklistTitle,
											isComplete && styles.completedTitle,
										]}
									>
										{checklist.title}
									</Text>
									{isComplete && (
										<Ionicons
											name="checkmark-circle"
											size={24}
											color="#4CAF50"
											style={styles.completedIcon}
										/>
									)}
								</View>

								<View style={styles.progressContainer}>
									<View style={styles.progressBar}>
										<View
											style={[
												styles.progressFill,
												{
													width: `${progressPercentage}%`,
												},
											]}
										/>
									</View>
									<Text style={styles.progressText}>
										{progressPercentage}%
									</Text>
								</View>
							</View>

							<View style={styles.itemsList}>
								{checklist.items &&
								checklist.items.length > 0 ? (
									// Sort items - unchecked first, then checked/strikethrough
									[...checklist.items]
										.sort((a, b) => {
											const stateA =
												itemStates[checklist.id]?.[
													a.id
												] || UNCHECKED;
											const stateB =
												itemStates[checklist.id]?.[
													b.id
												] || UNCHECKED;

											// If A is unchecked and B is not, A comes first
											if (
												stateA === UNCHECKED &&
												stateB !== UNCHECKED
											)
												return -1;
											// If B is unchecked and A is not, B comes first
											if (
												stateB === UNCHECKED &&
												stateA !== UNCHECKED
											)
												return 1;
											// Otherwise maintain original order
											return 0;
										})
										.map((item, index, sortedArray) => {
											const itemState =
												itemStates[checklist.id]?.[
													item.id
												] || UNCHECKED;

											return (
												<TouchableOpacity
													key={item.id}
													style={[
														styles.checklistItem,
														index === 0 &&
															styles.firstItem,
														index ===
															sortedArray.length -
																1 &&
															styles.lastItem,
													]}
													onPress={() =>
														toggleItemState(
															checklist.id,
															item.id,
														)
													}
													activeOpacity={0.7}
												>
													<View
														style={
															styles.itemContent
														}
													>
														<View
															style={
																styles.checkboxContainer
															}
														>
															{itemState ===
																UNCHECKED && (
																<View
																	style={
																		styles.uncheckedBox
																	}
																/>
															)}
															{itemState ===
																CHECKED && (
																<Ionicons
																	name="checkmark-circle"
																	size={24}
																	color="#4CAF50"
																/>
															)}
															{itemState ===
																STRIKETHROUGH && (
																<Ionicons
																	name="checkmark-circle"
																	size={24}
																	color="#9E9E9E"
																/>
															)}
														</View>

														<Text
															style={[
																styles.itemText,
																itemState ===
																	CHECKED &&
																	styles.checkedText,
																itemState ===
																	STRIKETHROUGH &&
																	styles.strikethroughText,
															]}
														>
															{item.text}
														</Text>
													</View>
												</TouchableOpacity>
											);
										})
								) : (
									<View style={styles.emptyItemsContainer}>
										<Text style={styles.emptyText}>
											No items in this checklist
										</Text>
									</View>
								)}
							</View>
						</View>
					);
				})}
			</ScrollView>
		</View>
	);
};

export default EventChecklists;
