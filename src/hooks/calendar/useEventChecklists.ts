import { useState, useEffect, useRef, useCallback } from "react";
import { LayoutAnimation, Alert } from "react-native";
import { useUser } from "../../contexts/UserContext";
import {
	getChecklistsByIds,
	updateEventChecklist,
	subscribeEventChecklist,
} from "../../services/eventService";
import { Checklist, ChecklistItemStates } from "../../types";

// Constants for item states
export const UNCHECKED = 0;
export const CHECKED = 1;
export const STRIKETHROUGH = 2;

const CHECKLIST_LAYOUT_ANIMATION = {
	duration: 300,
	update: { type: LayoutAnimation.Types.easeInEaseOut },
	create: {
		type: LayoutAnimation.Types.easeInEaseOut,
		property: LayoutAnimation.Properties.opacity,
	},
	delete: {
		type: LayoutAnimation.Types.easeInEaseOut,
		property: LayoutAnimation.Properties.opacity,
	},
};

interface UseEventChecklistsParams {
	checklistIds: string[];
	eventId: string;
}

interface UseEventChecklistsReturn {
	loading: boolean;
	checklists: Checklist[];
	itemStates: ChecklistItemStates;
	toggleItemState: (checklistId: string, itemId: string) => void;
	isChecklistComplete: (checklistId: string) => boolean;
	getProgressPercentage: (checklistId: string) => number;
}

export const useEventChecklists = ({
	checklistIds,
	eventId,
}: UseEventChecklistsParams): UseEventChecklistsReturn => {
	const { companyId } = useUser();

	const [loading, setLoading] = useState(true);
	const [checklists, setChecklists] = useState<Checklist[]>([]);
	const [itemStates, setItemStates] = useState<ChecklistItemStates>({});
	const [animationsEnabled, setAnimationsEnabled] = useState(false);
	const hasInitializedRef = useRef(false);

	// Fetch checklists from the provided IDs
	useEffect(() => {
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
				const checklistItems = await getChecklistsByIds(
					companyId,
					checklistIds,
				);

				// Initialize item states for all checklist items
				const initialItemStates: ChecklistItemStates = {};
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
	}, [checklistIds, companyId, eventId]);

	// After initial data loading is complete, enable animations
	useEffect(() => {
		if (!loading && !hasInitializedRef.current) {
			hasInitializedRef.current = true;
			setTimeout(() => {
				setAnimationsEnabled(true);
			}, 500);
		}
	}, [loading]);

	// Subscribe to saved checklist states
	useEffect(() => {
		let unsubscribeFunction: (() => void) | null = null;

		const loadSavedChecklistStates = async () => {
			if (!eventId || !companyId) return;

			try {
				unsubscribeFunction = await subscribeEventChecklist(
					companyId,
					eventId,
					(snapshot) => {
						const savedStates: Record<
							string,
							Record<string, number>
						> = {};

						snapshot.forEach((doc) => {
							savedStates[doc.id] = doc.data() as Record<
								string,
								number
							>;
						});

						if (animationsEnabled) {
							LayoutAnimation.configureNext(
								CHECKLIST_LAYOUT_ANIMATION,
							);
						}

						setItemStates((prevStates) => {
							const newStates = { ...prevStates };
							Object.keys(savedStates).forEach((checklistId) => {
								if (newStates[checklistId]) {
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
	}, [checklists, companyId, eventId, animationsEnabled]);

	// Save checklist state to Firestore
	const saveChecklistState = useCallback(
		async (checklistId: string, newState: Record<string, number>) => {
			if (!eventId || !companyId) return;

			try {
				await updateEventChecklist(
					companyId,
					eventId,
					checklistId,
					newState,
				);
			} catch (error) {
				console.error("Error saving checklist state:", error);
				Alert.alert("Error", "Failed to save checklist state");
			}
		},
		[eventId, companyId],
	);

	// Toggle item state with animation
	const toggleItemState = useCallback(
		(checklistId: string, itemId: string) => {
			LayoutAnimation.configureNext(CHECKLIST_LAYOUT_ANIMATION);

			setItemStates((prevStates) => {
				const currentState = prevStates[checklistId][itemId];
				const newState = (currentState + 1) % 3;

				const updatedChecklistState = {
					...prevStates[checklistId],
					[itemId]: newState,
				};

				saveChecklistState(checklistId, updatedChecklistState);

				return {
					...prevStates,
					[checklistId]: updatedChecklistState,
				};
			});
		},
		[saveChecklistState],
	);

	// Check if all items in a checklist are checked
	const isChecklistComplete = useCallback(
		(checklistId: string): boolean => {
			if (!itemStates[checklistId]) return false;

			const checklist = checklists.find((cl) => cl.id === checklistId);
			if (!checklist || !checklist.items || checklist.items.length === 0)
				return false;

			return checklist.items.every(
				(item) =>
					itemStates[checklistId][item.id] === CHECKED ||
					itemStates[checklistId][item.id] === STRIKETHROUGH,
			);
		},
		[itemStates, checklists],
	);

	// Calculate progress percentage for a checklist
	const getProgressPercentage = useCallback(
		(checklistId: string): number => {
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
		},
		[itemStates, checklists],
	);

	return {
		loading,
		checklists,
		itemStates,
		toggleItemState,
		isChecklistComplete,
		getProgressPercentage,
	};
};
